import * as _ from 'underscore';
import JavaPolyBase from './JavaPolyBase';
import ProxyWrapper from './ProxyWrapper';
import NodeDispatcher from '../dispatcher/NodeDispatcher.js'
import WrapperUtil from './WrapperUtil.js';
import CommonUtils from './CommonUtils.js';

const DEFAULT_JAVAPOLY_STANDALONE_OPTIONS = {
  doppioBase: '',
  javapolyBase: '',

  /**
   * When page is loading look for all corresponding MIME-types and create objects for Java automatically
   * @type {Boolean}
   */
  initOnStart: true,

  /**
   * Directory name that stores all class-files, jars and/or java-files
   * @type {String}
   */
  storageDir: '/tmp/data',

  /**
   * Enable Java Assertions
   *
   * @type {boolean}
   */
   assertionsEnabled : false
}

/**
 * Main JavaPoly class that do all underliying job for initialization
 * Simple usage:
 * 1. Create object: (new JavaPolyStandalone());
 * 2. Use JavaPoly API classes such as `J` and `Java`.
 *
 * (new JavaPoly());
 * Java.type(....).then(() => {  } );
 */
export default class JavaPoly extends JavaPolyBase {
  constructor(_options) {
    const options = _.extend(DEFAULT_JAVAPOLY_STANDALONE_OPTIONS, _options);
    super(options);

    // Init objects for user to make possible start to work with JavaPoly instantly
    // only bind this api to global.window for the default javapoly instance (the 1th instance, created in main.js).
    return this.initApiObjects(JavaPolyBase.idCount === 1 ? global : undefined);
  }

  beginLoading(resolveDispatcherReady) {
    this.dispatcher = new NodeDispatcher(this);
    resolveDispatcherReady(this.dispatcher);

    WrapperUtil.dispatchOnJVM(this,'META_START_JVM', 0, null);
  }

  processScripts() {
    // NOP
  }
}
