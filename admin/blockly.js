"use strict";

//console.error("Blockly gotify");

if (typeof goog !== "undefined") {
    goog.provide("Blockly.JavaScript.Sendto");

    goog.require("Blockly.JavaScript");
}

// remove it somewhere, because it defined in javascript=>blocks_words.js from javascript>=4.6.0
Blockly.Translate =
    Blockly.Translate ||
    function (word, lang) {
        lang = lang || systemLang;
        if (Blockly.Words && Blockly.Words[word]) {
            return Blockly.Words[word][lang] || Blockly.Words[word].en;
        } else {
            return word;
        }
    };

/// --- SendTo gotify --------------------------------------------------
Blockly.Words["gotify"] = { en: "gotify", de: "gotify", ru: "gotify" };
Blockly.Words["gotify_message"] = { en: "message", de: "Meldung", ru: "сообщение" };
Blockly.Words["gotify_title"] = { en: "title (optional)", de: "Betreff (optional)", ru: "заголовок (не обяз.)" };
Blockly.Words["gotify_priority"] = { en: "priority", de: "Priorität", ru: "приоритет" };

Blockly.Words["gotify_anyInstance"] = { en: "all instances", de: "Alle Instanzen", ru: "На все драйвера" };
Blockly.Words["gotify_tooltip"] = {
    en: "Send message to gotify",
    de: "Sende eine Meldung über gotify",
    ru: "Послать сообщение через gotify",
};
Blockly.Words["gotify_help"] = {
    en: "https://github.com/ioBroker/ioBroker.gotify/blob/master/README.md",
    de: "https://github.com/ioBroker/ioBroker.gotify/blob/master/README.md",
    ru: "https://github.com/ioBroker/ioBroker.gotify/blob/master/README.md",
};

Blockly.Sendto.blocks["gotify"] =
    '<block type="gotify">' +
    '     <value name="INSTANCE">' +
    "     </value>" +
    '     <value name="MESSAGE">' +
    '         <shadow type="text">' +
    '             <field name="TEXT">text</field>' +
    "         </shadow>" +
    "     </value>" +
    '     <value name="TITLE">' +
    "     </value>" +
    '     <value name="PRIORITY">' +
    "     </value>" +
    "</block>";

Blockly.Blocks["gotify"] = {
    init: function () {
        var options = [[Blockly.Translate("gotify_anyInstance"), ""]];
        if (typeof main !== "undefined" && main.instances) {
            for (var i = 0; i < main.instances.length; i++) {
                var m = main.instances[i].match(/^system.adapter.gotify.(\d+)$/);
                if (m) {
                    var n = parseInt(m[1], 10);
                    options.push(["gotify." + n, "." + n]);
                }
            }
        }

        if (!options.length) {
            for (var u = 0; u <= 4; u++) {
                options.push(["gotify." + u, "." + u]);
            }
        }

        this.appendDummyInput("INSTANCE")
            .appendField(Blockly.Translate("gotify"))
            .appendField(new Blockly.FieldDropdown(options), "INSTANCE");

        this.appendValueInput("MESSAGE").appendField(Blockly.Translate("gotify_message"));

        this.appendDummyInput("PRIORITY")
            .appendField(Blockly.Translate("gotify_priority"))
            .appendField(
                new Blockly.FieldDropdown([
                    [Blockly.Translate("gotify_normal"), "4"],
                    [Blockly.Translate("gotify_high"), "9"],
                    [Blockly.Translate("gotify_quiet"), "1"],
                    [Blockly.Translate("gotify_confirmation"), "2"],
                ]),
                "PRIORITY",
            );

        var input = this.appendValueInput("TITLE").setCheck("String").appendField(Blockly.Translate("gotify_title"));

        if (input.connection) {
            input.connection._optional = true;
        }

        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);

        this.setColour(Blockly.Sendto.HUE);
        this.setTooltip(Blockly.Translate("gotify_tooltip"));
        this.setHelpUrl(Blockly.Translate("gotify_help"));
    },
};

Blockly.JavaScript["gotify"] = function (block) {
    var dropdown_instance = block.getFieldValue("INSTANCE");
    var message = Blockly.JavaScript.valueToCode(block, "MESSAGE", Blockly.JavaScript.ORDER_ATOMIC);
    var text = "{\n";

    var value = parseInt(block.getFieldValue("PRIORITY"), 10);
    if (value) text += "   priority: " + value + ",\n";

    value = Blockly.JavaScript.valueToCode(block, "TITLE", Blockly.JavaScript.ORDER_ATOMIC);
    if (value) text += "   title: " + value + ",\n";

    text += "   message: " + message + "\n";

    text += "}";
    var logText;

    return 'sendTo("gotify' + dropdown_instance + '", "send", ' + text + ");\n";
};
