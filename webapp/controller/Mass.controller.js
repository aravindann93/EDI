sap.ui.define([
		"sap/ui/core/mvc/Controller",
		"sap/m/MessageBox",
		"./utilities",
		"sap/ui/core/routing/History"
	], function (BaseController, MessageBox, Utilities, History) {
		"use strict";
		return BaseController.extend("com.olympus.apps.edi.controller.Mass", {
			handleRouteMatched: function (oEvent) {
				var oParams = {};
				if (oEvent.mParameters.data.context) {
					this.sContext = oEvent.mParameters.data.context;
					var oPath;
					if (this.sContext) {
						oPath = {
							path: "/" + this.sContext,
							parameters: oParams
						};
						this.getView().bindObject(oPath);
					}
				}
			},
			_onButtonPress: function (oEvent) {
				oEvent = jQuery.extend(true, {}, oEvent);
				return new Promise(function (fnResolve) {
					fnResolve(true);
				}).then(function (result) {
					return new Promise(function (fnResolve) {
						var sTargetPos = "center center";
						sTargetPos = sTargetPos === "default" ? undefined : sTargetPos;
						sap.m.MessageToast.show("Boarded Successfully", {
							onClose: fnResolve,
							duration: 5000 || 3000,
							at: sTargetPos,
							my: sTargetPos
						});
					});
				}.bind(this)).then(function (result) {
					if (result === false) {
						return false;
					} else {
						var oView = this.getView();
						var oController = this;
						return new Promise(function (fnResolve, fnReject) {
							var oModel = oController.oModel;
							var fnResetChangesAndReject = function (sMessage) {
								oModel.resetChanges();
								fnReject(new Error(sMessage));
							};
							if (oModel && oModel.hasPendingChanges()) {
								oModel.submitChanges({
									success: function (oResponse) {
										var oBatchResponse = oResponse.__batchResponses[0];
										var oChangeResponse = oBatchResponse.__changeResponses && oBatchResponse.__changeResponses[0];
										if (oChangeResponse && oChangeResponse.data) {
											var sNewContext = oModel.getKey(oChangeResponse.data);
											oView.unbindObject();
											oView.bindObject({
												path: "/" + sNewContext
											});
											if (window.history && window.history.replaceState) {
												window.history.replaceState(undefined, undefined, window.location.hash.replace(encodeURIComponent(oController.sContext),
													encodeURIComponent(sNewContext)));
											}
											oModel.refresh();
											fnResolve();
										} else if (oChangeResponse && oChangeResponse.response) {
											fnResetChangesAndReject(oChangeResponse.message);
										} else if (!oChangeResponse && oBatchResponse.response) {
											fnResetChangesAndReject(oBatchResponse.message);
										} else {
											oModel.refresh();
											fnResolve();
										}
									},
									error: function (oError) {
										fnReject(new Error(oError.message));
									}
								});
							} else {
								fnResolve();
							}
						});
					}
				}.bind(this)).catch(function (err) {
					if (err !== undefined) {
						MessageBox.error(err.message);
					}
				});
			},
			onUpload: function (e) {
				var fU = this.getView().byId("idfileUploader");
				var domRef = fU.getFocusDomRef();
				var file = domRef.files[0];
				// Create a File Reader object
				var reader = new FileReader();
				var t = this;
				reader.onload = function (e) {
					var strCSV = e.target.result;
					var arrCSV = strCSV.match(/[\w .]+(?=,?)/g);
					// var noOfCols = 17;
						var noOfCols = 11;
					// To ignore the first row which is header
					var hdrRow = arrCSV.splice(0, noOfCols);
					var data = [];
					while (arrCSV.length > 0) {
						var obj = {};
						// extract remaining rows one by one
						var row = arrCSV.splice(0, noOfCols);
						for (var i = 0; i < row.length; i++) {
							obj[hdrRow[i]] = row[i].trim();
						}
						// push row to an array
						data.push(obj);
					}
					// Bind the data to the Table
					var oModel = new sap.ui.model.json.JSONModel();
					oModel.setData(data);
					var oTable = t.byId("idTable");
					oTable.setModel(oModel);
				};
				reader.readAsBinaryString(file);
			},
			_onButtonPress1: function (oEvent) {
				var oBindingContext = oEvent.getSource().getBindingContext();
				return new Promise(function (fnResolve) {
					this.doNavigate("EdiCustomerOnbording", oBindingContext, fnResolve, "");
				}.bind(this)).catch(function (err) {
					if (err !== undefined) {
						MessageBox.error(err.message);
					}
				});
			},
			doNavigate: function (sRouteName, oBindingContext, fnPromiseResolve, sViaRelation) {
				var sPath = oBindingContext ? oBindingContext.getPath() : null;
				var oModel = oBindingContext ? oBindingContext.getModel() : null;
				var sEntityNameSet;
				if (sPath !== null && sPath !== "") {
					if (sPath.substring(0, 1) === "/") {
						sPath = sPath.substring(1);
					}
					sEntityNameSet = sPath.split("(")[0];
				}
				var sNavigationPropertyName;
				var sMasterContext = this.sMasterContext ? this.sMasterContext : sPath;
				if (sEntityNameSet !== null) {
					sNavigationPropertyName = sViaRelation || this.getOwnerComponent().getNavigationPropertyForNavigationWithContext(sEntityNameSet,
						sRouteName);
				}
				if (sNavigationPropertyName !== null && sNavigationPropertyName !== undefined) {
					if (sNavigationPropertyName === "") {
						this.oRouter.navTo(sRouteName, {
							context: sPath,
							masterContext: sMasterContext
						}, false);
					} else {
						oModel.createBindingContext(sNavigationPropertyName, oBindingContext, null, function (bindingContext) {
							if (bindingContext) {
								sPath = bindingContext.getPath();
								if (sPath.substring(0, 1) === "/") {
									sPath = sPath.substring(1);
								}
							} else {
								sPath = "undefined";
							}
							// If the navigation is a 1-n, sPath would be "undefined" as this is not supported in Build
							if (sPath === "undefined") {
								this.oRouter.navTo(sRouteName);
							} else {
								this.oRouter.navTo(sRouteName, {
									context: sPath,
									masterContext: sMasterContext
								}, false);
							}
						}.bind(this));
					}
				} else {
					this.oRouter.navTo(sRouteName);
				}
				if (typeof fnPromiseResolve === "function") {
					fnPromiseResolve();
				}
			},
			_onUploadCollectionUploadComplete: function (oEvent) {
				var oFile = oEvent.getParameter("files")[0];
				var iStatus = oFile ? oFile.status : 500;
				var sResponseRaw = oFile ? oFile.responseRaw : "";
				var oSourceBindingContext = oEvent.getSource().getBindingContext();
				var sSourceEntityId = oSourceBindingContext ? oSourceBindingContext.getProperty("") : null;
				var oModel = this.getView().getModel();
				return new Promise(function (fnResolve, fnReject) {
					if (iStatus !== 200) {
						fnReject(new Error("Upload failed"));
					} else if (oModel.hasPendingChanges()) {
						fnReject(new Error("Please save your changes, first"));
					} else if (!sSourceEntityId) {
						fnReject(new Error("No source entity key"));
					} else {
						try {
							var oResponse = JSON.parse(sResponseRaw);
							var oNewEntityInstance = {};
							oNewEntityInstance[""] = oResponse["ID"];
							oNewEntityInstance[""] = sSourceEntityId;
							oModel.createEntry("", {
								properties: oNewEntityInstance
							});
							oModel.submitChanges({
								success: function (oResponse) {
									var oChangeResponse = oResponse.__batchResponses[0].__changeResponses[0];
									if (oChangeResponse && oChangeResponse.response) {
										oModel.resetChanges();
										fnReject(new Error(oChangeResponse.message));
									} else {
										oModel.refresh();
										fnResolve();
									}
								},
								error: function (oError) {
									fnReject(new Error(oError.message));
								}
							});
						} catch (err) {
							var message = typeof err === "string" ? err : err.message;
							fnReject(new Error("Error: " + message));
						}
					}
				}).catch(function (err) {
					if (err !== undefined) {
						MessageBox.error(err.message);
					}
				});
			},
			_onUploadCollectionChange: function (oEvent) {
				var oUploadCollection = oEvent.getSource();
				var aFiles = oEvent.getParameter("files");
				if (aFiles && aFiles.length) {
					var oFile = aFiles[0];
					var sFileName = oFile.name;
					var oDataModel = this.getView().getModel();
					if (oUploadCollection && sFileName && oDataModel) {
						var sXsrfToken = oDataModel.getSecurityToken();
						var oCsrfParameter = new sap.m.UploadCollectionParameter({
							name: "x-csrf-token",
							value: sXsrfToken
						});
						oUploadCollection.addHeaderParameter(oCsrfParameter);
						var oContentDispositionParameter = new sap.m.UploadCollectionParameter({
							name: "content-disposition",
							value: "inline; filename=\"" + encodeURIComponent(sFileName) + "\""
						});
						oUploadCollection.addHeaderParameter(oContentDispositionParameter);
					} else {
						throw new Error("Not enough information available");
					}
				}
			},
			_onUploadCollectionTypeMissmatch: function () {
				return new Promise(function (fnResolve) {
					sap.m.MessageBox.warning(
						"The file you are trying to upload does not have an authorized file type (JPEG, JPG, GIF, PNG, TXT, PDF, XLSX, DOCX, PPTX).", {
							title: "Invalid File Type",
							onClose: function () {
								fnResolve();
							}
						});
				}).catch(function (err) {
					if (err !== undefined) {
						MessageBox.error(err);
					}
				});
			},
			_onUploadCollectionFileSizeExceed: function () {
				return new Promise(function (fnResolve) {
					sap.m.MessageBox.warning("The file you are trying to upload is too large (10MB max).", {
						title: "File Too Large",
						onClose: function () {
							fnResolve();
						}
					});
				}).catch(function (err) {
					if (err !== undefined) {
						MessageBox.error(err);
					}
				});
			},
			onInit: function () {
				this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
				this.oRouter.getTarget("Mass").attachDisplay(jQuery.proxy(this.handleRouteMatched, this));
				var oView = this.getView();
				oView.addEventDelegate({
					onBeforeShow: function () {
						if (sap.ui.Device.system.phone) {
							var oPage = oView.getContent()[0];
							if (oPage.getShowNavButton && !oPage.getShowNavButton()) {
								oPage.setShowNavButton(true);
								oPage.attachNavButtonPress(function () {
									this.oRouter.navTo("EdiCustomerOnbording", {}, true);
								}.bind(this));
							}
						}
					}.bind(this)
				});
				this.oModel = this.getOwnerComponent().getModel();
			},
			/**
			 *@memberOf com.olympus.apps.edi.controller.Mass
			 */
			saveData: function (oEvent) {
				return new Promise(function(fnResolve) {
				var sTargetPos = "center center";
				sTargetPos = (sTargetPos === "default") ? undefined : sTargetPos;
				sap.m.MessageToast.show("Boarded Successfully", {
					onClose: fnResolve,
					duration: 5000 || 3000,
					at: sTargetPos,
					my: sTargetPos
				});
			}).catch(function(err) {
				if (err !== undefined) {
					MessageBox.error(err.message);
				}
			});
			}
		});
	}, /* bExport= */
	true);