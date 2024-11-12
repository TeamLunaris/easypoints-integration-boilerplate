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

function getEasyPointsSession() {
  var easyPointsSession = sessionStorage.getItem(SESSION_KEY);
  return easyPointsSession ? JSON.parse(easyPointsSession) : {};
}

function setEasyPointsSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
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

  // COMBAK: Can be removed once SDK supports tiers display. (Lorenzo ~ 2024-07-04)
  Locale: {
    get() {
      const defaultLocale = 'en';

      if (EasyPointsAppBlockData && EasyPointsAppBlockData.shop) {
        const { locale } = EasyPointsAppBlockData.shop;

        return locale || defaultLocale;
      }

      return defaultLocale;
    }
  },

  // COMBAK: Can be removed once SDK supports tiers display. (Lorenzo ~ 2024-07-04)
  Currency: {
    getFormatOptions() {
      if (EasyPointsAppBlockData && EasyPointsAppBlockData.shop) {
        var { money_format_options = null } = EasyPointsAppBlockData.shop;
        return money_format_options;
      }

      return null;
    },

    getRate: function() {
      return (Shopify && Shopify.currency && Shopify.currency.rate) || 1;
    },

    getActiveString: function(fallback = "JPY") {
      return (
        (Shopify && Shopify.currency && Shopify.currency.active) || fallback
      );
    },

    format(amount, { convert = false, multiplier = 1, format = null } = {}) {
      amount = Math.round(
        (convert ? amount * EasyPointsCore.Currency.getRate() : amount) *
        multiplier
      );
      var money =
        amount / 100 + " " + EasyPointsCore.Currency.getActiveString();

      if (
        Shopify &&
        Shopify.formatMoney !== undefined &&
        ((EasyPointsAppBlockData && EasyPointsAppBlockData.shop.money_format) || format)
      ) {
        money = Shopify.formatMoney(
          amount,
          format || EasyPointsAppBlockData.shop.money_format
        );
      }

      return money;
    },
  },

  Tiers: {
    getNextTier: function(subtotal = 0) {
      var { rankAdvancementData } = getEasyPointsSession();

      if (!rankAdvancementData) {
        throw Error('EasyPointsCore: missing tiers rank data.')
      }

      var nextTier =
        rankAdvancementData.tiers
          .find((tier) => {
            var diff = (tier.raw_amount * getMultiplier()) - subtotal;
            return Math.max(diff, 0) > 0;
          });

      if (nextTier) {
        return {
          name: nextTier.name,
          advancementAmountRaw: nextTier.raw_amount,
          advancementAmountMultiplied: (nextTier.raw_amount * getMultiplier()) - subtotal,
        }
      }

      return null;
    },

    getMaxTier: function() {
      var { rankAdvancementData } = getEasyPointsSession();

      return rankAdvancementData.tiers.sort((a, b) => b.raw_amount - a.raw_amount)[0];
    },
  },
};

var EasyPointsUI = {
  // COMBAK: Can be removed once SDK supports tiers display. (Lorenzo ~ 2024-07-04)
  Tiers: {
    render() {
      const { tierName, rankMaintenanceData, rankAdvancementData } = getEasyPointsSession();
      const formatOptions = EasyPointsCore.Currency.getFormatOptions() || { convert: true, multiplier: 100 };

      if (tierName) {
        document.querySelectorAll('[data-loyal-target="tier-name"]')
          .forEach((tierNameEl) => {
            tierNameEl.textContent = tierName;
          });
      }

      if (rankMaintenanceData) {
        Array.prototype.slice.call(
          document.querySelectorAll('[data-loyal-target="rank-maintenance-amount"]')
        ).forEach((target) => {
          target.textContent = EasyPointsCore.Currency.format(rankMaintenanceData.raw_amount, formatOptions);
        });

        var rankMaintenanceDeadline;
        if (rankMaintenanceData.deadline) {
          rankMaintenanceDeadline = new Date(rankMaintenanceData.deadline);
          rankMaintenanceDeadline = rankMaintenanceDeadline.toLocaleDateString(EasyPointsCore.Locale.get());
        } else {
          rankMaintenanceDeadline = 'N/A';
        }

        Array.prototype.slice.call(
          document.querySelectorAll('[data-loyal-target="rank-maintenance-deadline"]')
        ).forEach((target) => {
          target.textContent = rankMaintenanceDeadline;
        });
      }

      if (rankAdvancementData) {
        var nextTier = EasyPointsCore.Tiers.getNextTier();
        var maxTier = EasyPointsCore.Tiers.getMaxTier();

        if (nextTier) {
          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="rank-advancement-amount"]')
          ).forEach((target) => {
            target.textContent = EasyPointsCore.Currency.format(nextTier.advancementAmountRaw, formatOptions);
          });

          var rankAdvancementDeadline;
          if (rankAdvancementData.deadline) {
            rankAdvancementDeadline = new Date(rankAdvancementData.deadline);
            rankAdvancementDeadline = rankAdvancementDeadline.toLocaleDateString(EasyPointsCore.Locale.get());
          } else {
            rankAdvancementDeadline = 'N/A';
          }

          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="rank-advancement-deadline"]')
          ).forEach((target) => {
            target.textContent = rankAdvancementDeadline;
          });

          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="rank-advancement-tier-name"]')
          ).forEach((target) => {
            target.textContent = nextTier.name;
          });
        } else if (maxTier) {
          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="not-max-rank"]')
          ).forEach((target) => {
            target.style.display = "none";
          });

          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="rank-advancement-tier-name"]')
          ).forEach((target) => {
            target.textContent = maxTier.name;
          });

          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="max-rank"]')
          ).forEach((target) => {
            target.style.removeProperty("display");
          });
        } else {
          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="max-rank"]')
          ).forEach((target) => {
            target.style.display = "none";
          });

          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="not-max-rank"]')
          ).forEach((target) => {
            target.style.display = "none";
          });
        }
      }
    }
  },
};

// COMBAK: Can be removed once SDK supports tiers display. (Lorenzo ~ 2024-07-04)
function updateAllLoyaltyTargets() {
  EasyPointsUI.Tiers.render();
}

window.addEventListener('DOMContentLoaded', function() {
  updateAllLoyaltyTargets();

  var redirectUrlEle = document.body.querySelector('input[data-loyal-target="redirect_url"]');
  if (redirectUrlEle) {
    redirectUrlEle.value = window.location.pathname;
  }

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

  function fetchOrderDetails() {
    orderIds = [];
    var orderDetailNodes = document.querySelectorAll("[data-loyal-order-points]");
    var orderDetails = Array.prototype.slice.call(orderDetailNodes);

    orderDetails.forEach(function(orderDetail) {
      var orderEleNodes = orderDetail.querySelectorAll("[data-loyal-order-id]");
      var orderEles = Array.prototype.slice.call(orderEleNodes);

      orderEles.forEach(function(orderEle) {
        var orderId = orderEle.getAttribute("data-loyal-order-id");
        orderIds.push(orderId);
      });
    });

    if (orderIds.length > 0 && custId) {
      var params = new URLSearchParams({ "order_ids": orderIds });
      var xhr = new XMLHttpRequest();
      xhr.open("GET", `/apps/loyalty/customers/${custId}/orders?` + params.toString());

      xhr.onload = function() {
        if (xhr.status === 200) {
          var resp = JSON.parse(xhr.response);

          orderDetails.forEach(function(orderDetail) {
            var orderEleNodes = orderDetail.querySelectorAll("[data-loyal-order-id]");
            var orderEles = Array.prototype.slice.call(orderEleNodes);

            orderEles.forEach(function(orderEle) {
              var orderId = orderEle.getAttribute("data-loyal-order-id");
              var orderData = resp.orders[orderId];

              if (orderData) {
                orderEle.querySelectorAll("[data-loyal-target]").forEach(function(target) {
                  var loyaltyTarget = target.getAttribute("data-loyal-target");

                  if (loyaltyTarget == "awardable-points") {
                    target.innerHTML = formatBigNumber(orderData.awardable_points);
                  } else if (loyaltyTarget == "points-redeemed") {
                    target.innerHTML = formatBigNumber(orderData.points_redeemed);
                  } else if (loyaltyTarget == "points-awarded") {
                    target.innerHTML = formatBigNumber(orderData.points_awarded);
                  }
                });
              }
            });
          });
        }
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
  async(fetchOrderDetails);
});
