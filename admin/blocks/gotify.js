"use strict";

/// --- SendTo gotify --------------------------------------------------
Blockly.Words["gotify"] = { en: "gotify", de: "gotify" };
Blockly.Words["gotify_message"] = { en: "message", de: "Meldung" };
Blockly.Words["gotify_title"] = { en: "title (optional)", de: "Betreff (optional)" };
Blockly.Words["gotify_priority"] = { en: "priority", de: "Priorität" };
Blockly.Words["gotify_prio_min"] = { en: "minimum", de: "Minimale Priorität" };
Blockly.Words["gotify_prio_low"] = { en: "low", de: "Niedrige Priorität" };
Blockly.Words["gotify_prio_default"] = { en: "default", de: "Normal" };
Blockly.Words["gotify_prio_high"] = { en: "high priority", de: "Hohe Priorität" };
Blockly.Words["gotify_format"] = { en: "format", de: "Format" };
Blockly.Words["gotify_format_text"] = { en: "text", de: "Text" };
Blockly.Words["gotify_format_markdown"] = { en: "markdown", de: "Markdown" };

Blockly.Words["gotify_anyInstance"] = { en: "all instances", de: "Alle Instanzen" };
Blockly.Words["gotify_tooltip"] = {
    en: "Send message to gotify",
    de: "Sende eine Meldung über gotify",
};
Blockly.Words["gotify_help"] = {
    en: "https://github.com/ThomasPohl/ioBroker.gotify/blob/master/README.md",
    de: "https://github.com/ThomasPohl/ioBroker.gotify/blob/master/README.md",
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
    '     <value name="FORMAT">' +
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

        this.appendDummyInput("FORMAT")
            .appendField(Blockly.Translate("gotify_format"))
            .appendField(
                new Blockly.FieldDropdown([
                    [Blockly.Translate("gotify_format_text"), "text/plain"],
                    [Blockly.Translate("gotify_format_markdown"), "text/markdown"],
                ]),
                "FORMAT",
            );

        this.appendDummyInput("PRIORITY")
            .appendField(Blockly.Translate("gotify_priority"))
            .appendField(
                new Blockly.FieldDropdown([
                    [Blockly.Translate("gotify_prio_min"), "0"],
                    [Blockly.Translate("gotify_prio_low"), "1"],
                    [Blockly.Translate("gotify_prio_default"), "4"],
                    [Blockly.Translate("gotify_prio_high"), "8"],
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

    var format = block.getFieldValue("FORMAT");
    if (format) text += "   contentType: '" + format + "',\n";

    text += "   message: " + message + "\n";

    text += "}";
    var logText;

    return 'sendTo("gotify' + dropdown_instance + '", "send", ' + text + ");\n";
};
