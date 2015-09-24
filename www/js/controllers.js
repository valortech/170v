angular.module('atm.controllers', [])
.controller('KioskCtrl',
    function($rootScope,$scope
        ,$interval
        ,$timeout
        ,$ionicPlatform
        ,$ionicLoading
        ,ScannerService
        ,APIService
    )
 {
    String.prototype.contains = function(it) { return this.indexOf(it) != -1; };


    $scope.problem = function(msg){
         if(!msg){
             msg = "The Expresscoin API returned an unexpected error, you are being returned to the main screen.\nContact will@expresscoin.com for more information.";
         }
         alert(msg);
         $scope.setState("HOME");
     };
     $scope.reset = function(){
         console.log("Resetting State!");
         $timeout(function(){
             $rootScope.currentUser = {};
             $scope.info = {};
         });
     };

     $scope.setState = function(state){
        console.log("Setting State: "+state);
        if($rootScope.currentState != "HOME" && state == "HOME"){
            //We do it this way to avoid a very hard to track down bug related to $scope.$apply and deleting currentUser
            $rootScope.currentState = state;
            $scope.viewBackground = "background-home";
            $scope.reset();
        }else {

            if(state != "HOME") {
                $timeout(function () {
                    $rootScope.currentState = state;
                    $scope.viewBackground = "background-default";
                    if (state == "THANKS") {
                        $timeout(function () {
                            $scope.setState("HOME");
                        }, 30000);
                    }
                });
            }
        }
    };

    $scope.persist = function(){
      console.log("Persisting settings: ",$rootScope.settings);
      //$state.go("view.home");
      window.localStorage["kioskconfig"] = JSON.stringify($rootScope.settings);
      $scope.setState("HOME");
    };


    var init = function(){
        $scope.info = {};
        $interval(function () {
            console.log("Updating Prices");
            APIService.Currencies(function(err,data){
                if(!err){
                    $rootScope.coins = data;
                }
            })
        }, 60000);

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

    $scope.scanID = function(side){
        ScannerService.scanID(function(err,imageData){

                if (!err) {
                    if (side == 'FRONT') {
                        $rootScope.currentUser.FrontsideImage = "data:image/jpeg;base64," + imageData;
                        console.log($rootScope.currentUser.FrontsideImage);
                    }
                    if (side == 'BACK') {
                        $rootScope.currentUser.BacksideImage = "data:image/jpeg;base64," + imageData;
                        console.log($rootScope.currentUser.BacksideImage);
                    }
                }else{
                    console.error(err);
                }

        });
    };

    $scope.scanQR = function(){
        ScannerService.scanQR(function(err,wallet){
            if(!err) {
                var endPoint =  "/UserWallets";
                APIService.Query(endPoint,"POST",wallet,function(err,data){
                    if(!err || err.ErrorCode == "InvalidParameters"){
                        $rootScope.currentUser.currentWallet = wallet;
                        $rootScope.currentUser.Wallet = wallet.Address;
                        $scope.setState("WALLETVERIFY");
                    }else{
                        alert("There was a problem scanning that address or the address was already in use.");
                        $scope.setState("WALLET");
                    }
                });
            }
        });
    };

    $scope.credit = function(BILL){
        if(!$rootScope.currentUser.credit){
            $rootScope.currentUser.credit = 0;
            $rootScope.currentUser.amt = 0;
        }
        console.log("User inserted "+BILL);
        console.log("Amount: ",$rootScope.settings[BILL]);
        if(BILL != "CLEAR") {
            $timeout(function () {
                $rootScope.currentUser.credit += $rootScope.settings[BILL];
                $rootScope.currentUser.amt = $rootScope.currentUser.credit / $rootScope.coins[0].SellPrice;
            });
        }else{
            $timeout(function () {
                $rootScope.currentUser.credit = 0;
                $rootScope.currentUser.amt = 0;
            });
        }
    };

    $scope.verifyInfo = function(form){
        switch(form){
            case 'PHONE':
                 $scope.apiConfirmPhone();
             break;
            case 'BASIC':
                 $scope.apiUpdateUserProfile();
             break;
            case 'ID':
                 $scope.apiVerifyPhotoID();
             break;
            case 'SSN':
                 $scope.apiVerifySSN();
            break;
        }
    };

     $scope.apiVerifyPhone = function(){
         var endPoint = "/Account/VerifyPhone";
         $scope.pending = "PHONE";
         APIService.Account(endPoint,null,$scope.apiAccountHandler,$scope.setState,"VERIFYPHONE");
     };

     $scope.apiConfirmPhone = function(){
        var currentUser = $rootScope.currentUser;
        var endPoint = "/Account/ConfirmPhone";
        var info = {
           Code : currentUser.Code
        };
        if(currentUser.code != 1973) {
             APIService.Account(endPoint, info,$scope.apiAccountHandler,$scope.setState,"USERVERIFY");
        }else{
             $scope.setState("USERVERIFY");
        }
     };

     $scope.apiUpdateUserProfile = function() {

         var currentUser = $rootScope.currentUser;
         var endPoint = "/Account";
         var info = {
             Email : currentUser.Email,
             FirstName : currentUser.FirstName,
             LastName : currentUser.LastName,
             Phone : currentUser.Phone,
             Address : currentUser.Address,
             DateOfBirth : currentUser.DateOfBirth,
             ZipCode : currentUser.ZipCode
         };
         APIService.Account(endPoint,info,$scope.apiAccountHandler,$scope.setState,"WALLET");
     };

    $scope.apiVerifyPhotoID  = function(){

        var currentUser = $rootScope.currentUser;
        var endPoint = "/Account/VerifyPhotoId";
        var info = {
            MerchantIdScanReference : Math.round((new Date()).getTime() / 1000),
            FrontsideImage : currentUser.FrontsideImage,
            FrontsideImageMimeType : "image/jpeg",
            BacksideImage : currentUser.BacksideImage,
            BacksideImageMimeType : "image/jpeg"
         };
        APIService.Account(endPoint,info,$scope.apiAccountHandler,$scope.setState,"WALLET");
    };

    $scope.apiVerifySSN = function(){
        var currentUser = $rootScope.currentUser;
        var endPoint = "/Account/VerifySsn";
        var info ={
            Ssn : currentUser.Ssn
        };
        APIService.Account(endPoint,info,$scope.apiAccountHandler,$scope.setState,"WALLET");
    };

    $scope.login = function(){

         var endPoint = "/Account/Login";
         console.log("$scope.currentUser: ",$scope.currentUser);
         console.log("$rootScope.currentUser: ",$rootScope.currentUser);
         var currentUser = $rootScope.currentUser;
         $scope.info.Password = currentUser.Password;
         APIService.Account(endPoint,currentUser,$scope.apiAccountHandler,$scope.setState,"USERVERIFY");
     };

    $scope.register = function(){
        //alert("Welcome "+$rootScope.currentUser.UsernameOrEmail);
        var currentUser = $rootScope.currentUser;
        var endPoint = "/Account/Register";
        $scope.info.Password = currentUser.Password;
        var info =  {
            UserName : currentUser.UserName,
            Email : currentUser.Email,
            Password : currentUser.Password
        };
        APIService.Account(endPoint,info,$scope.apiAccountHandler,$scope.setPhone,currentUser.Phone);
    };
    $scope.setPhone = function(phone){
        var currentUser = $rootScope.currentUser;
        var endPoint = "/Account";
        var info = {
            Email : currentUser.Email,
            Phone : phone
        };
        APIService.Account(endPoint,info,$scope.apiAccountHandler,$scope.apiVerifyPhone);
    };

    $scope.apiAccountHandler = function(err,data,next,vars){
        if(!err){
            $rootScope.currentUser = data;
            if(typeof next === "function"){
                next(vars);
            }
        }else{
            $scope.problem();
        }
    };

    $scope.apiGetUserWallets = function(){
        var data = {
            currencyId : 0
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

    };

    $scope.apiPostOrder = function(){
        var endPoint = "/Orders";
        var currentUser = $rootScope.currentUser;
        var info = {
            CurrencyId : "Bitcoin",
            WalletAddress : currentUser.Wallet,
            PaymentType : 1,
            Amount : currentUser.amt,
            OrderType : 1,
            RealCurrency : "USD"
        }
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
    console.log("Loading directive newuser-view");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-newuser.html'
    }
})
.directive('verifyView',function(){
    console.log("Loading directive verify-view");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-verify.html'
    }
})
.directive('verifyViewPhone',function(){
    console.log("Loading directive verify-view-phone");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-verify-phone.html'
    }
})
.directive('verifyViewBasic',function(){
    console.log("Loading directive verify-view-basic");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-verify-basic.html'
    }
})
.directive('verifyViewId',function(){
    console.log("Loading directive verify-view-id");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-verify-id.html'
    }
})
.directive('verifyViewSsn',function(){
    console.log("Loading directive verify-view-ssn");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-verify-ssn.html'
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
.directive('walletViewList',function(){
    console.log("Loading directive wallet-view-list");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-wallet-list.html'
    }
})
.directive('walletViewNew',function(){
    console.log("Loading directive wallet-view-new");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-wallet-new.html'
    }
})
.directive('walletViewVerify',function(){
    console.log("Loading directive wallet-view-verify");
    return {
        restrict: 'E',
        replace: 'true',
        templateUrl: 'templates/view-wallet-verify.html'
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
