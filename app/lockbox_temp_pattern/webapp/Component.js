sap.ui.define([
    "sap/fe/core/AppComponent",
    "file/temp/lockboxtemppattern/ext/controller/ObjectPageExt",
    "file/temp/lockboxtemppattern/ext/util/Formatter"
], function (AppComponent, ObjectPageExt, Formatter) {
    "use strict";

    window.ObjectPageExt = ObjectPageExt;
    window.Formatter = Formatter;

    return AppComponent.extend("file.temp.lockboxtemppattern.Component", {
        metadata: {
            manifest: "json"
        }
    });
});