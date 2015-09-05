angular.module('atm.controllers', [])

.controller('KioskCtrl', function($rootScope,$scope,$http,$interval,$timeout) {

    $scope.setState = function(state){
        console.log("Setting State: "+state);
        if($rootScope.currentState != "HOME" && state == "HOME"){
            $rootScope.currentState = state;
            $scope.reset();
        }else {
            if(state != "HOME") {
                $timeout(function () {
                    $rootScope.currentState = state;
                    if (state == "THANKS") {
                        $timeout(function () {
                            $scope.reset();
                        }, 30000);
                    }
                });
            }
        }
    };

    $scope.reset = function(){
        console.log("Resetting State!");
        $rootScope.$apply(function(){
            $rootScope.currentUser = null;
            $rootScope.currentForm = null;
            $scope.currentForm = null;
            $scope.currentUser = null;
            $scope.setState("HOME");
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

    $scope.credit = function(BILL){
        console.log("User inserted "+BILL);
        if(!$rootScope.currentUser){
            alert("Contact Support:  You were not logged in, returning you to home screen now.");
            $scope.reset();
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

        $rootScope.currentUser = {
            credit: 0
        };
        $rootScope.currentUser.product = selection;
        $scope.setState("ACCOUNT");
        $rootScope.currentForm = null;
    };

    $scope.login = function(){
      alert("Welcome "+$rootScope.currentUser.UsernameOrEmail);
        $scope.setState("CASH");
    };

    $scope.register = function(){
      alert("Welcome "+$rootScope.currentUser.Email);
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
