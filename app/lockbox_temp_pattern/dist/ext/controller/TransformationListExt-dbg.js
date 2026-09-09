sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension"
], function (ControllerExtension) {
    "use strict";

    return ControllerExtension.extend(
        "file.temp.lockboxtemppattern.ext.controller.TransformationListExt",
        {
            override: {

                onInit: function () {
                    console.log(
                        "TransformationListExt initialized"
                    );
                },

                routing: {

                    onAfterBinding: function () {
                        console.log(
                            "Transformation List binding completed - refreshing"
                        );

                        var oExtensionAPI = this.base.getExtensionAPI();

                        if (oExtensionAPI) {
                            oExtensionAPI.refresh()
                                .then(function () {
                                    console.log(
                                        "Transformation List refreshed successfully"
                                    );
                                })
                                .catch(function (oError) {
                                    console.error(
                                        "Transformation List refresh failed",
                                        oError
                                    );
                                });
                        }
                    }

                }
            }
        }
    );
});