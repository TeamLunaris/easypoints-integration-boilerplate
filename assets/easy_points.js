const POINT_RATIO = 1.0;

function getMultiplier() {
  if (!window.EasyPointsData) {
    throw new Error('missing loyalty data, make sure required liquid is rendered.');
  }

  return window.EasyPointsData.shop.multiplier * EasyPointsCore.Currency.getRate();
}

function formatBigNumber(int) {
  return int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function totalBonusPoints() {
  var eles = document.querySelectorAll("[data-loyal-bonus-points]");
  var productBonusPoints = {};
  var points = 0;

  eles.forEach(function(ele) {
    var bonusPointAttributes = ele.getAttribute("data-loyal-bonus-points");
    bonusPointAttributes = JSON.parse(bonusPointAttributes);

    var productPoints = bonusPointAttributes.bonusPoints;
    var currentProductPoints = productBonusPoints[bonusPointAttributes.productId];

    if (!currentProductPoints || currentProductPoints < productPoints) {
      productBonusPoints[bonusPointAttributes.productId] = productPoints;
    }
  });

  var values = Object.values(productBonusPoints);

  for (i = 0; i < values.length; i++) {
    points += values[i];
  }

  return points;
}

var easyPointsSession = getEasyPointsSession();
var pointRulePointValue = easyPointsSession.customerPointRulePointValue;
var pointRuleCurrencyValue = easyPointsSession.customerPointRuleCurrencyValue;
var pointRulePercent = null;

function htmlRedirectInput() {
  var input = document.createElement("input");
  input.type = "text";
  input.setAttribute("name", "html_redirect");
  input.value = "true";
  return input;
}

function buildForm(action, formId = "point-redemption-form", name = "coupon") {
  var virtualForm = document.getElementById(formId);
  if (virtualForm) {
    var inputs = Array.from(virtualForm.getElementsByTagName("input"));

    var form = document.createElement("form");
    form.method = "post";
    form.action = action;
    form.classList.add("easy-points-hide");

    inputs.forEach(function(input, ind) {
      form.appendChild(input.cloneNode());
    });

    form.appendChild(htmlRedirectInput());
    return form;
  } else {
    return null;
  }
}

function submitForm(form) {
  document.body.appendChild(form);
  form.submit();
}

function getEasyPointsSession() {
  var easyPointsSession = sessionStorage.getItem("easyPoints");
  return easyPointsSession ? JSON.parse(easyPointsSession) : {};
}

function setEasyPointsSession(easyPointsSession) {
  sessionStorage.setItem("easyPoints", JSON.stringify(easyPointsSession));
}

function setEasyPointsSessionItem(key, value) {
  var easyPointsSession = getEasyPointsSession();
  easyPointsSession[key] = value;
  setEasyPointsSession(easyPointsSession);
}

function removeEasyPointsSessionItem(key) {
  var easyPointsSession = getEasyPointsSession();
  delete easyPointsSession[key];
  setEasyPointsSession(easyPointsSession);
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

  Note: {
    submit(e) {
      var btn = e.target;
      if (btn) {
        btn.setAttribute('disabled', true);
        btn.style.cursor = 'progress';
      }

      var form = buildForm('/apps/loyalty/customers', 'easypoints-note-update', 'customer');
      if (form) {
        fetch(form.action, {
          method: 'post',
          body: new FormData(form)
        }).then(() => {
          window.location.reload();
        });
      }
    }
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

  PointExchangeProducts: {
    addToCart: function(productId, quantity = 1) {
      var pointExchangeProductEle = document.querySelector(
        `[data-loyal_product_id="${productId}"][data-loyal_point_exchange]`
      );

      if (!pointExchangeProductEle) { return true; }

      var easyPointsSession = getEasyPointsSession();
      var pointBalance = easyPointsSession.pointBalance;
      var pointExchangeProductAttrs = JSON.parse(pointExchangeProductEle.dataset.loyal_point_exchange);
      var newPointBalance = pointBalance - pointExchangeProductAttrs.point_cost * quantity;

      if (newPointBalance < 0) { return false; }
      setEasyPointsSessionItem("pointBalance", newPointBalance);
      return true;
    },

    removeFromCart: function(productId, quantity = 1) {
      var pointExchangeProductEle = document.querySelector(
        `[data-loyal_product_id="${productId}"][data-loyal_point_exchange]`
      );

      if (!pointExchangeProductEle) { return true; }

      var easyPointsSession = getEasyPointsSession();
      var pointBalance = easyPointsSession.pointBalance;
      var pointExchangeProductAttrs = JSON.parse(pointExchangeProductEle.dataset.loyal_point_exchange);
      var newPointBalance = pointBalance + pointExchangeProductAttrs.point_cost * quantity;

      setEasyPointsSessionItem("pointBalance", newPointBalance);
      return true;
    },
  }
};

var EasyPointsUI = {

  BALANCE_EXPIRATION_CONTAINER_SELECTOR: '[data-loyal-target="balance-expiration"]',
  BALANCE_EXPIRATION_DATE_SELECTORS: {
    YY: '[data-loyal-target="balance-expiration__yy"]',
    MM: '[data-loyal-target="balance-expiration__mm"]',
    DD: '[data-loyal-target="balance-expiration__dd"]',
  },

  renderBalanceExpiration: function(date) {
    var containers = document.body.querySelectorAll(EasyPointsUI.BALANCE_EXPIRATION_CONTAINER_SELECTOR);

    if (containers.length == 0) {
      return;
    }

    if (date == null) {
      containers.forEach(function(container) {
        container.classList.add('easy-points-hide');
      });

      return;
    }

    date = new Date(date);

    var yy = date.getFullYear();
    var mm = date.getMonth() + 1;
    var dd = date.getDate();

    containers.forEach(function(container) {
      container.classList.remove('easy-points-hide');

      container
        .querySelectorAll(EasyPointsUI.BALANCE_EXPIRATION_DATE_SELECTORS.YY)
        .forEach(function(el) { el.textContent = yy; });

      container
        .querySelectorAll(EasyPointsUI.BALANCE_EXPIRATION_DATE_SELECTORS.MM)
        .forEach(function(el) {el.textContent = mm; });

      container
        .querySelectorAll(EasyPointsUI.BALANCE_EXPIRATION_DATE_SELECTORS.DD)
        .forEach(function(el) { el.textContent = dd; });
    });
  },

  Note: {
    showSubmit() {
      var form = document.getElementById('easypoints-note-update');
      if (form) {
        form.classList.add('easy-points__form--changed');
      }
    },

    addValuesChangedListener() {
      var input = document.querySelector('#easypoints-note-update input[name="customer[easypoints_birthday]"]');
      if (input) {
        input.addEventListener('input', this.showSubmit)
      }
    },

    addSubmitListener() {
      var noteUpdateSubmit = document.getElementById('easypoints-note-update-submit');
      if (noteUpdateSubmit) {
        noteUpdateSubmit.addEventListener('click', EasyPointsCore.Note.submit);
      }
    }
  },

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

  PointExchangeProducts: {
    addEventListeners() {
      var buyWithPoints = document.getElementById('easypoints_buy-with-points');
      if (buyWithPoints) {
        buyWithPoints.addEventListener('click', EasyPointsCore.PointExchangeProducts.addToCart);
      }
    }
  }
};

window.addEventListener('DOMContentLoaded', function() {
  EasyPointsUI.Note.addSubmitListener();
  EasyPointsUI.Note.addValuesChangedListener();
});

window.addEventListener('DOMContentLoaded', function() {
  EasyPointsUI.Tiers.render();

  var shopDomainEle = document.getElementById("shopDomain");
  var shopDomain = shopDomainEle ? shopDomainEle.value : null;

  var redirectUrlEle = document.body.querySelector(
    'input[data-loyal-target="redirect_url"]'
  );

  if (redirectUrlEle) {
    redirectUrlEle.value = window.location.pathname;
  }

  var custIdEle = document.getElementById("customerId");
  var custId = custIdEle ? custIdEle.value : null;

  function staleSessionKey(key, easyPointsSession = null) {
    easyPointsSession = easyPointsSession || getEasyPointsSession();
    var date = easyPointsSession[key];
    return !date || (new Date() - new Date(date)) > 300000;
  }

  function fetchAndUpdatePointRule(force = false) {
    var easyPointsSession = getEasyPointsSession();

    if (shopDomain && (
      force ||
      (custId && staleSessionKey('customerMetafieldUpdatedAt', easyPointsSession)) ||
      staleSessionKey('shopMetafieldUpdatedAt', easyPointsSession)
    )) {
      var data = {};
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

          if (!custId) {
            easyPointsSession.shopMetafieldUpdatedAt = new Date();
          }

          setEasyPointsSession(easyPointsSession);
          updatePointRule(easyPointsSession);
        };
      };

      xhr.send();
    }
  }

  function updatePointRule(easyPointsSession = null) {
    easyPointsSession = easyPointsSession || getEasyPointsSession();

    var percentEle = document.body.querySelector(
      'input[data-loyal-target="shop-point-rule-percent"]'
    );
    var pointValueEle = document.body.querySelector(
      'input[data-loyal-target="shop-point-rule-point-value"]'
    );
    var currencyValueEle = document.body.querySelector(
      'input[data-loyal-target="shop-point-rule-currency-value"]'
    );

    var pointValue = easyPointsSession.customerPointRulePointValue;
    var currencyValue = easyPointsSession.customerPointRuleCurrencyValue;
    percentEle.value = easyPointsSession.customerPointRulePercentage;
    pointValueEle.value = pointValue;
    currencyValueEle.value = currencyValue;

    EasyPointsUI.Tiers.render();

    document.querySelectorAll('[data-loyal-target="point-value"]:not([data-loyal-block])')
      .forEach(function(ele) {
        var currencyCost = parseInt(ele.dataset.loyalCurrencyCost) / getMultiplier();
        var points = currencyCost * (pointValue / currencyValue);
        var target = ele.querySelector('[data-loyal-target="point-value-location"]');

        var bonusPointAttributes = ele.getAttribute("data-loyal-bonus-points");
        if (bonusPointAttributes) {
          bonusPointAttributes = JSON.parse(bonusPointAttributes);
          var bonusPointPercent = bonusPointAttributes.pointValue / bonusPointAttributes.currencyValue;
          bonusPointAttributes.bonusPoints = Math.floor(currencyCost * bonusPointPercent);
          ele.setAttribute("data-loyal-bonus-points", JSON.stringify(bonusPointAttributes));
          points += bonusPointAttributes.bonusPoints;
        }

        if (ele.hasAttribute("data-loyal-cart-subtotal")) {
          points += totalBonusPoints();
        }

        if (ele.dataset.loyalRound === "up") {
          points = Math.ceil(points);
        } else {
          points = Math.floor(points);
        }

        target.textContent = formatBigNumber(points);
      });
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

    if (orderIds.length > 0 && custId && shopDomain) {
      var params = new URLSearchParams({"order_ids": orderIds});
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

  async(fetchAndUpdatePointRule);
  async(fetchOrderDetails);
});
