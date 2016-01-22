const classfile = require('./../tools/classfile.js');

/**
 * The DoppioManager manages the JVM and filesystem.
 * It can be run in Browser or WebWorker.
 * It assumes that the .js for BrowserFS and Doppio is already loaded.
 */
class DoppioManager {
  constructor(javapoly) {
    this.javapoly = javapoly;

    this.fs = null;

    /**
     * Stores referense to the special extension for fs (for example it contains recursive mkdir)
     * @type {[type]}
     */
    this.fsext = null;

    /**
     * Array that contains classpath, include the root path of class files , jar file path.
     * @type {Array}
     */
    this.classpath = [this.getOptions().storageDir];

    this.mountHub = [];

    this.initBrowserFS();
  }

  getOptions() {
    return this.javapoly.options;
  }

  /**
   * Initialization of BrowserFS
   */
  initBrowserFS(){
    const mfs = new BrowserFS.FileSystem.MountableFileSystem();
    BrowserFS.initialize(mfs);
    mfs.mount('/tmp', new BrowserFS.FileSystem.InMemory());

    // FIXME local storage can't be used in WebWorker, check if it affect anything.
    if (!this.javapoly.isJavaPolyWorker) {
      mfs.mount('/home', new BrowserFS.FileSystem.LocalStorage());
    }

    const options = this.getOptions();

    this.bfsReady = new Promise((resolve) => {
      DoppioManager.xhrRetrieve(options.doppioLibUrl + "/listings.json", "json").then(doppioListings => {
        DoppioManager.xhrRetrieve(options.javaPolyBaseUrl + "/listings.json", "json").then(javapolyListings => {
          mfs.mount('/sys', new BrowserFS.FileSystem.XmlHttpRequest(doppioListings, options.doppioLibUrl));
          mfs.mount('/javapoly', new BrowserFS.FileSystem.XmlHttpRequest(javapolyListings, options.javaPolyBaseUrl));

          this.fs = BrowserFS.BFSRequire('fs');
          this.path = BrowserFS.BFSRequire('path');
          this.fsext = require('./../tools/fsext')(this.fs, this.path);
          this.fsext.rmkdirSync(options.storageDir);
          BrowserFS.install(this);
          this.installStreamHandlers();
          resolve();
        });
      });
    });

  }

  mountJar(src) {
  	const Buffer = global.BrowserFS.BFSRequire('buffer').Buffer;
    const options = this.getOptions();
    this.bfsReady.then(() => {
      this.mountHub.push(
        new Promise((resolve, reject) => {
          this.writeRemoteJarFileIntoFS(src).then(
            (jarStorePath) => { this.classpath.push(jarStorePath); resolve(); },
            reject );
        })
      );
    });
  }

  writeRemoteJarFileIntoFS(src){
    const Buffer = global.BrowserFS.BFSRequire('buffer').Buffer;
    const options = this.getOptions();
    return new Promise((resolve, reject) => {
      DoppioManager.xhrRetrieve(src, "arraybuffer").then(data => {
        const jarFileData = new Buffer(data);
        const jarName = this.path.basename(src);
        const jarStorePath = this.path.join(options.storageDir, jarName);
        // store the .jar file to $storageDir
        this.fs.writeFile(jarStorePath, jarFileData, (err) => {
          if (err) {
            console.error(err.message);
            reject();
          } else {
            // add .jar file path to the URL of URLClassLoader
            //this.classpath.push(jarStorePath);

            //need to pass the path, will add that path to ClassLoader of Main.java
            resolve(jarStorePath);
          }
        });
      });
    });
  }

  mountClass(src) {
    this.bfsReady.then(() => {
      this.mountHub.push(
        this.writeRemoteClassFileIntoFS(src)
      );
    });
  }

  writeRemoteClassFileIntoFS(src){
    const Buffer = global.BrowserFS.BFSRequire('buffer').Buffer;
    const options = this.getOptions();
    return new Promise((resolve, reject) => {
      DoppioManager.xhrRetrieve(src, "arraybuffer").then(data => {
        const classFileData = new Buffer(data);
        const classFileInfo = classfile.analyze(classFileData);
        const className   = this.path.basename(classFileInfo.this_class);
        const packageName = this.path.dirname(classFileInfo.this_class);

        this.fsext.rmkdirSync(this.path.join(options.storageDir, packageName));

        this.fs.writeFile(this.path.join(options.storageDir, classFileInfo.this_class + '.class'),
          classFileData, (err) => {
            if (err) {
              console.error(err.message);
              reject();
            } else {
              resolve();
            }
          }
        );
      });
    });
  }

  initJVM() {
    const options = this.getOptions();
    const responsiveness = this.javapoly.isJavaPolyWorker ? 100 : 10;
    this.bfsReady.then(() => {
      Promise.all(this.mountHub).then(() => {
        this.javapoly.jvm = new Doppio.VM.JVM({
          doppioHomePath: options.doppioLibUrl,
          bootstrapClasspath: ['/sys/vendor/java_home/lib/rt.jar', "/javapoly/classes"],
          classpath: this.classpath,
          javaHomePath: '/sys/vendor/java_home',
          extractionPath: '/tmp',
          nativeClasspath: ['/sys/natives', "/javapoly/natives"],
          assertionsEnabled: options.assertionsEnabled,
          responsiveness: responsiveness
        }, (err, jvm) => {
          if (err) {
            console.log('err loading JVM ' + this.javapoly.getId() + ' :', err);
          } else {
            jvm.runClass('com.javapoly.Main', [this.javapoly.getId()], function(exitCode) {
              // Control flow shouldn't reach here under normal circumstances,
              // because Main thread keeps polling for messages.
              console.log("JVM Exit code: ", exitCode);
            });
          }
        });
      });
    });
  }

  installStreamHandlers() {
    this.process.stdout.on('data', (data) => {
      const ds = data.toString();
      if (ds != "\n") {
        console.log("JVM " + this.javapoly.getId() + " stdout>", ds);
      }
    });
    this.process.stderr.on('data', (data) => {
      const ds = data.toString();
      if (ds != "\n") {
        console.warn("JVM " + this.javapoly.getId() + " stderr>", ds);
      }
    });
  }

  static xhrRetrieve (url, responseType) {
    return new Promise((resolve, reject) => {
      const xmlr = new XMLHttpRequest();
      xmlr.open('GET', url, true);
      xmlr.responseType = responseType;
      xmlr.onreadystatechange = ()=> {
        if (xmlr.readyState === 4) {
          if (xmlr.status === 200) {
            resolve(xmlr.response);
          } else {
            reject();
          }
        }
      }
      xmlr.send(null);
    });
  }
}

export default DoppioManager;
