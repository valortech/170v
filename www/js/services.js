angular.module('atm.services', [])
.factory('ScannerService',
    function(
        $ionicPlatform
        ,$timeout
        ,$cordovaBarcodeScanner
        ,$cordovaCamera
    ){
        console.log("ScannerService instantiated");
        return {
            scanID : function(cb){
                $ionicPlatform.ready(function(){
                    var options = {
                        quality: 100,
                        destinationType: Camera.DestinationType.DATA_URL,
                        sourceType: Camera.PictureSourceType.CAMERA,
                        allowEdit: true,
                        encodingType: Camera.EncodingType.JPEG,
                        targetWidth: 200,
                        targetHeight: 150,
                        popoverOptions: CameraPopoverOptions,
                        saveToPhotoAlbum: false,
                        correctOrientation:true,
                        cameraDirection: 1
                    };

                    $cordovaCamera.getPicture(options).then(function(imageData) {
                        console.log("cordova: ",imageData);
                        console.log("cb: ",cb);
                        cb(null,imageData);
                    }, function(err) {
                        console.error(err);
                        alert("There was a problem scanning your ID");
                        cb(err,null);
                    });
                });
            },

            scanQR : function(cb){
                $ionicPlatform.ready(function() {
                    $cordovaBarcodeScanner
                        .scan()
                        .then(function(barcodeData) {
                            console.log("user scanned: ",barcodeData);
                            //alert("Captured: "+JSON.stringify(barcodeData));

                            if(barcodeData.cancelled){
                                return;
                            }
                            var address;
                            var coin;
                            var text = barcodeData.text;
                            if(text.contains(":")){
                                var startPos = text.indexOf(":")+1;
                                var endPos = text.length;
                                //It's a url, we're interested only in : to ?
                                if(text.contains("?")){
                                    endPos = text.indexOf("?");
                                }
                                address = text.substr(startPos,endPos);
                                coin = text.substr(0,startPos -1);
                            }else{
                                address = text;
                                coin = "bitcoin";
                            }

                            var data = {
                                Name : "Scanned Wallet from ATM",
                                CurrencyId : "Bitcoin",
                                Address : address,
                                LocationId : 0,
                                OtherLocation: "Blockchain"
                            };
                            cb(null,data);
                        }, function(error) {
                            alert("Scan Failed! Please try again later!");
                            $scope.setState("WALLET");
                        });

                });
            }
        }
})
.factory('APIService',
    function(
        $http
        ,$interval
        ,$httpParamSerializerJQLike
        ,$ionicLoading
    ){
        var currentToken ="";
        var baseUrl = "https://api.expresscoin.com/api";


        return{
            _setParams : function(url,data, method,cb){
                console.log("data for setParams: ",data);
                var params = {
                    url: url,
                    method: method,
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                };

                if(data){
                    params.data = $httpParamSerializerJQLike(data);
                }

                if(currentToken.length >0) {
                    params.headers["Auth-Token"] = currentToken;
                }
                cb(params);
            },
            Query : function(endPoint, method, info, cb, next, vars) {
                this._setParams(baseUrl + endPoint, info, method, function (params) {
                    $http(params)
                        .success(function (data, status, headers, config) {
                            $ionicLoading.hide();
                            var head = headers();
                            console.log("Headers: ", head);
                            console.log("data: ", data);
                            currentToken = head["auth-token"];
                            cb(null, data, next, vars);
                        })
                        .error(function (err) {
                            console.error(err);
                            $ionicLoading.hide();

                            cb(err, null, next, vars);

                            console.error(err);
                        });
                });
            },
            Account : function(endPoint, info, cb, next, vars){
                this.Query(endPoint,"POST", info ,cb,next,vars);
            },
            Currencies : function(cb){
                $http.get(baseUrl+"/Currencies")
                    .success(function (data) {
                        console.log("Got: ",data);
                        cb(null,data);
                    })
                    .error(function (data, status, headers, config) {
                        console.error("Failed to get coins: " + status);
                        cb(status,null);
                    });
            }

        }
});