'use strict';

/*global goog:true */
/*global document:true */

if (typeof goog !== 'undefined') {
    goog.provide('Blockly.JavaScript.Sendto');

    goog.require('Blockly.JavaScript');
}

function loadJS(filename) {
    console.log(`Loading ${filename}`);
    const scriptTag = document.createElement('script');
    try {
        scriptTag.src = filename;

        document.body.appendChild(scriptTag);
    } catch (e) {
        console.error(`Cannot load ${filename}: ${e}`);
    }
}
loadJS('../gotify/blocks/gotify.js');
