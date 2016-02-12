import CommonUtils from '../core/CommonUtils.js';
import WrapperUtil from '../core/WrapperUtil.js';

import http from 'http';

/**
 * The NodeDoppioManager manages the Doppio JVM on Node
 */
export default class NodeSystemManager {
  constructor(javapoly, secret, httpPortDeffered, dispatcher) {
    this.javapoly = javapoly;
    // this.wsPort = wsPort;
    this.httpPortDeffered = httpPortDeffered;
    this.secret = secret;
    this.dispatcher = dispatcher;

    /**
     * Array that contains classpath, include the root path of class files , jar file path.
     * @type {Array}
     */
    const options = this.getOptions();
    this.classpath = [options.javapolyBase + "/classes", options.storageDir];

  }

  getOptions() {
    return this.javapoly.options;
  }

  dynamicMountJava(src) {
    const fs = require("fs");
    const options = this.getOptions();
    return new Promise((resolve, reject) => {
      // remote file, we need to download the file data of that url and parse the type.
      fs.readFile(src, (err, fileDataBuf) => {
        if (err) {
          reject(err);
        } else {
          // remote java class/jar file
          if (CommonUtils.isClassFile(fileDataBuf)){
            this.writeRemoteClassFileIntoFS(src, fileDataBuf).then(resolve, reject);
          } else if (CommonUtils.isZipFile(fileDataBuf)){
            WrapperUtil.dispatchOnJVM(this.javapoly, 'JAR_PATH_ADD', 10, ['file://'+src], resolve, reject);
          } else {

            // remote java source code file
            const classInfo = CommonUtils.detectClassAndPackageNames(fileDataBuf.toString()) ;
            if (classInfo && classInfo.class ){
              const className = classInfo.class;
              const packageName = classInfo.package;
              return WrapperUtil.dispatchOnJVM(
                  this.javapoly, "FILE_COMPILE", 10,
                  [className, packageName ? packageName : "", options.storageDir, fileDataBuf.toString()], resolve, reject
                );
            }

            console.log('Unknown java file type', src);
            reject('Unknown java file type'+src);
          }
        }
      });
    })
  }

  writeRemoteClassFileIntoFS(src, classFileData){
    const path = require('path');
    const fs = require("fs");
    const options = this.getOptions();
    const classfile = require('./../tools/classfile.js');
    const fsext = require('./../tools/fsext')(fs, path);

    return new Promise((resolve, reject) => {
      const classFileInfo = classfile.analyze(classFileData);
      const className   = path.basename(classFileInfo.this_class);
      const packageName = path.dirname(classFileInfo.this_class);

      fsext.rmkdirSync(path.join(options.storageDir, packageName));

      fs.writeFile(path.join(options.storageDir, classFileInfo.this_class + '.class'),
        classFileData, (err) => {
          if (err) {
            console.error(err.message);
            reject(err.message);
          } else {
            resolve();
          }
        }
      );
    });
  }

  startTempServer() {
    const _this = this;

    return new Promise((resolve, reject) => {
      const srv = http.createServer((incoming, response) => {
        if (_this.dispatcher.verifyToken(incoming.headers["token"])) {
          _this.httpPortDeffered.resolve(incoming.headers["jvm-port"]);
          response.writeHead(200, {'Content-Type': 'text/plain' });
        } else {
          response.writeHead(404, {'Content-Type': 'text/plain' });
        }
        response.end();
        srv.close();
      });
      srv.listen(0, 'localhost', () => {
        resolve(srv.address().port);
      });
    });
  }

  initJVM() {
    this.startTempServer().then((serverPort) => {
      const childProcess = require('child_process');
      const spawn = childProcess.spawn;
      const classPath = CommonUtils.getCommonsPath()+':build/jars/java_websocket.jar:build/jars/javax.json-1.0.4.jar:build/classes:/tmp/data';
      const args = ['-cp', classPath, 'com.javapoly.Main', this.javapoly.getId(), "system", this.secret, serverPort];
      // const child = spawn('java', args, {detached: true, stdio: ['ignore', 'ignore', 'ignore']});
      const child = spawn('java', args, {detached: true, stdio: 'inherit'});
      child.unref();
    });
  }
}
