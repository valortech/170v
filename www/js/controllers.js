angular.module('atm.controllers', [])

.controller('KioskCtrl',
    function($rootScope,$scope
        ,$http
        ,$interval
        ,$timeout
        ,$ionicPlatform
        ,$ionicLoading
        ,$httpParamSerializerJQLike
        ,$cordovaBarcodeScanner
    )
 {
     String.prototype.contains = function(it) { return this.indexOf(it) != -1; };
    $scope.baseUrl = "https://api.expresscoin.com/api";
    $scope.setState = function(state){
        console.log("Setting State: "+state);
        if($rootScope.currentState != "HOME" && state == "HOME"){
            //We do it this way to avoid a very hard to track down bug related to $scope.$apply and deleting currentUser
            $rootScope.currentState = state;
            $scope.reset();
        }else {
            if(state != "HOME") {
                $timeout(function () {
                    $rootScope.currentState = state;
                    if (state == "THANKS") {
                        $timeout(function () {
                            $scope.setState("HOME");
                        }, 30000);
                    }
                });
            }
        }
    };

    $scope.reset = function(){
        console.log("Resetting State!");
        $timeout(function(){
            delete $rootScope.currentUser;
        });
    };

    $scope.persist = function(){
      console.log("Persisting settings: ",$rootScope.settings);
      //$state.go("view.home");
      window.localStorage["kioskconfig"] = JSON.stringify($rootScope.settings);
      $scope.setState("HOME");
    };


    init = function(){
      $interval(function () {
        console.log("Updating Prices");
        $http.get("https://api.expresscoin.com/api/Currencies")
            .success(function (data) {
              console.log("Got: ",data);
              $rootScope.coins = data;
            })
            .error(function (data, status, headers, config) {
              $scope.status = status;
              console.error("Failed to get coins: " + status);
            });
      }, 10000);
      if(window.localStorage["kioskconfig"]) {
        $rootScope.settings = JSON.parse(window.localStorage["kioskconfig"]);
        $scope.setState("HOME");
      }else{
        $rootScope.settings = {
            //Based on default settings for APEX 7000USD
            BILL1: 1,
            BILL2: 5,
            BILL3: 10,
            BILL4: 20,
            BILL5: 50,
            BILL6: 100,
            BILL7: 0
        };
        $scope.setState("CONFIG");
      }
    };

    $scope.scanQR = function(){
        $ionicPlatform.ready(function() {
            $cordovaBarcodeScanner
                .scan()
                .then(function(barcodeData) {
                    console.log("user scanned: ",barcodeData);
                    alert("Captured: "+JSON.stringify(barcodeData));
                    /**
                     {
                        cancelled: true|false,
                        text: "whatever was there",
                        format: "QR_CODE"
                    }
                     **/
                    var address = "";
                    var coin = $rootScope.currentUser.product.Name;
                    var logo = $rootScope.currentUser.product.LogoUrl;

                    if(barcodeData.cancelled){
                        return;
                    }

                    var text = barcodeData.text;
                    if(text.contains(":")){
                        var startPos = text.indexOf(":");
                        var endPos = text.length;
                        //It's a url, we're interested only in : to ?
                        if(text.contains("?")){
                            endPos = text.indexOf("?");
                        }
                        address = text.substr(startPos,endPos);
                        coin = text.substr(0,startpos -1);
                    }else{
                        address = text;
                    }

                    var temp = {
                        "Name": "Scanned Wallet from ATM",
                        "CurrencyId": $rootScope.currentUser.product.Name,
                        "Address": address,
                        "LocationId": 0,
                        "OtherLocation": "Blockchain"
                    };

                    var wallet = {
                        Address : address,
                        CurrencyName : coin,
                        CurrencyLogoUrl : logo
                    };

                    var params = $scope.setParams($scope.baseUrl+"/UserWallets",temp,"POST");
                    $http(params).success(
                        function(data, status, headers, config) {
                            var head = headers();
                            console.log("Headers: ", head);
                            console.log("data: ", data);

                            //Only returns OK or ERROR
                            $rootScope.currentUser["Auth-Token"] = head["auth-token"];
                            $rootScope.currentUser.currentWallet = wallet;
                            $scope.setState("CASH");
                        }
                    ).error(
                        function(data, status, headers, config) {
                            console.log("Error: ",data);
                            alert("There was a problem scanning that address or the address was already in use.");
                            alert("Error was: "+JSON.stringify(status)+" "+JSON.stringify(data));
                            alert("We sent: ",JSON.stringify(params));
                            $scope.setState("WALLET");
                        }
                    );

                }, function(error) {
                    alert("Scan Failed! Please try again later!");
                    $scope.setState("WALLET");
                });

        });
    };

    $scope.walletSelected = function(wallet){
        $rootScope.currentUser.currentWallet = wallet;
        $scope.setState("CASH");
    };

    $scope.credit = function(BILL){
        console.log("User inserted "+BILL);
        if(!$rootScope.currentUser
            || !$rootScope.currentUser.hasOwnProperty("credit")
            || !$rootScope.currentUser.hasOwnProperty("Email")){
                alert("Contact Support:  You were not logged in, returning you to home screen now.");
                $scope.reset();
                $scope.setState("HOME");
            return;
        }
        if(BILL != "CLEAR") {
            $timeout(function () {
                $rootScope.currentUser.credit += $rootScope.settings[BILL];
            });
        }else{
            $timeout(function () {
                $rootScope.currentUser.credit = 0;
            });
        }
    };
    $scope.finalize = function(){
        var coin = $rootScope.currentUser.product;
        var credit = $rootScope.currentUser.credit;
        var price = coin.SellPrice.toFixed(2);
        var amtCoin = (credit / price).toFixed(8);
        $rootScope.currentUser.amt = amtCoin;
        alert("You are about to purchase "+amtCoin+" "+coin.Code+" for $"+credit);
        $scope.setState("THANKS");
    };
    $scope.productSelected = function(selection){
        $rootScope.pendingUser = {
            credit: 0
        };
        $rootScope.pendingUser.product = selection;
        $rootScope.currentUser = {};
        $scope.setState("ACCOUNT");
    };


    $scope.login = function(){

        var endPoint = "/Account/Login";
        console.log("$scope.currentUser: ",$scope.currentUser);
        console.log("$rootScope.currentUser: ",$rootScope.currentUser);
        $ionicLoading.show();
        var params = $scope.setParams($scope.baseUrl+endPoint,$rootScope.currentUser, "POST");
        console.log("params: ",params);
        $http(params).success(
            function(data, status, headers, config) {
                var head = headers();
                console.log("Headers: ", head);
                console.log("data: ", data);
                $rootScope.currentUser = data;
                $rootScope.currentUser["Auth-Token"] = head["auth-token"];
                $rootScope.currentUser.product = $rootScope.pendingUser.product;
                $rootScope.currentUser.credit = 0;
                delete $rootScope.pendingUser;

                alert("Welcome to Expresscoin " + data.UserName + " !");
                console.log("Auth-Token: ", $rootScope.currentUser["Auth-Token"]);
                $ionicLoading.hide();
                $scope.setState("WALLET");
                //TODO: Grab api/UserWallets
                var data = {
                    currencyId : $rootScope.currentUser.product.Id
                };
                var params = $scope.setParams($scope.baseUrl+"/UserWallets",data,"GET");
                $http(params).success(
                    function(data,status,headers,config){
                        console.log("data: ",data);
                        $rootScope.currentUser.wallets = data;
                        $rootScope.currentUser["Auth-Token"] = head["auth-token"];
                        alert("Fetched: "+JSON.stringify(data));
                    }
                ).error(
                    function(data,status,headers,config){
                        alert("Error Retrieving Wallet: "+JSON.stringify(status)+"  "+JSON.stringify(data));
                    }
                );
            })
            .error(function(data,status,headers,config){
                console.error("data: ",data);
                console.error("status: ",status);
                console.error("headers: ",headers);
                console.error("config: ",config);
                $ionicLoading.hide();
                alert("Login Failed, please try again!")
            });
    };

    $scope.setParams = function(url,data, method){
         console.log("data for setParams: ",data);
        var params = {
            url: url,
            method: method,
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            data: $httpParamSerializerJQLike(data)
        };
        if($rootScope.currentUser) {
            if ($rootScope.currentUser["Auth-Token"]) {
                params.headers["Auth-Token"] = $rootScope.currentUser["Auth-Token"];
            }
        }
        return params;
    };

    $scope.register = function(){
      alert("Welcome "+$rootScope.currentUser.UsernameOrEmail);
        $scope.setState("CASH");
    };
    init();
})
.directive('homeView',function(){
  console.log("Loading directive home-view");
  return {
    restrict: 'E',
    replace: 'true',
    templateUrl: 'templates/view-home.html'
  }
})
.directive('accountView',function(){
    console.log("Loading directive account-view");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-account.html'
    }
})
.directive('loginView',function(){
    console.log("Loading directive login-view");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-login.html'
    }
})
.directive('newuserView',function(){
    console.log("Loading directive register-view");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-newuser.html'
    }
})
.directive('walletView',function(){
    console.log("Loading directive wallet-view");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-wallet.html'
    }
})
.directive('cashView',function(){
    console.log("Loading directive cash-view");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-cash.html'
    }
})
.directive('thanksView',function(){
    console.log("Loading directive thanks-view");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-thanks.html'
    }
})
.directive('configView',function(){
  console.log("Loading directive config-view");
  return {
    restrict: 'E',
    replace: 'true',
    templateUrl: 'templates/view-config.html'
  }
})
.directive('debugView',function(){
    console.log("Loading directive debug-view");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-debug.html'
    }
});
