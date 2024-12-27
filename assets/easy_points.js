var SESSION_KEY = 'easyPoints';

function getMultiplier() {
  if (!window.EasyPointsAppBlockData) {
    throw new Error('missing loyalty data, make sure required liquid is rendered.');
  }

  return window.EasyPointsAppBlockData.shop.multiplier * EasyPointsCore.Currency.getRate();
}

function formatBigNumber(int) {
  return int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

var EasyPointsCore = {
  Selectors: {
    TARGETS: {
      BALANCE: '[data-loyal-target="balance"]',
      APPLIED_DISCOUNT: '[data-loyal-target="applied-discount"]'
    },

    REDEMPTION: {
      POINTS_VALUE: '#redemption-point-value',
      POINTS_MAX: '#redemption-max-points'
    },
  },
};

window.addEventListener('DOMContentLoaded', function() {
  var custId = null;
  if (window.EasyPointsAppBlockData.customer !== null) {
    custId = window.EasyPointsAppBlockData.customer.id;
  }

  function staleSessionKey(session, key) {
    if (Object.keys(session).includes(key)) {
      return (new Date() - new Date(session[key])) > 300000;
    }

    return true;
  }

  function fetchSession() {
    var easyPointsSession = getEasyPointsSession();
    var updatedAt = custId ? 'customerMetafieldUpdatedAt' : 'shopMetafieldUpdatedAt';

    if (staleSessionKey(easyPointsSession, updatedAt)) {
      var route = "/apps/loyalty/order_point_rule";

      if (custId) {
        route = route + "/" + custId;
      }

      var xhr = new XMLHttpRequest();
      xhr.open("GET", route);

      xhr.onload = function() {
        if (xhr.status === 200) {
          var resp = JSON.parse(xhr.response);

          easyPointsSession.customerPointRulePercentage = parseInt(resp.percentage);
          easyPointsSession.customerPointRulePointValue = parseInt(resp.point_value);
          easyPointsSession.customerPointRuleCurrencyValue = parseInt(resp.currency_value);
          easyPointsSession.tierName = resp.tier_name;

          if (resp.tier_maintenance_data) {
            easyPointsSession.rankMaintenanceData = resp.tier_maintenance_data.maintenance_data;
            easyPointsSession.rankAdvancementData = resp.tier_maintenance_data.advancement_data;
          }

          if (custId) {
            easyPointsSession.customerMetafieldUpdatedAt = new Date();
          } else {
            easyPointsSession.shopMetafieldUpdatedAt = new Date();
          }

          setEasyPointsSession(easyPointsSession);
          updateAllLoyaltyTargets();
        };
      };

      xhr.send();
    }
  }

  function async(fn) {
    setTimeout(function() {
      fn();
    }, 0);
  }

  async(fetchSession);
});
