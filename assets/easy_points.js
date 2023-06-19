function formatBigNumber(int) {
  return int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function insertPointValue(ele) {
  var currencyCostString = ele.getAttribute("data-loyal-currency-cost");
  var regex = /[^\d]/g;
  var currencyCost = currencyCostString.replace(regex, "") / (100 * EasyPointsCore.Currency.getRate());

  var points = currencyCost * pointRulePercent;

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

  if (ele.getAttribute("data-loyal-round") == "up") {
    points = Math.ceil(points);
  } else {
    points = Math.floor(points);
  }

  insertPointValueIntoElement(ele, points);
}

function insertPointValueIntoElement(ele, pointValue) {
  ele.querySelectorAll('[data-loyal-target="point-value-location"]').forEach(function(target) {
    target.innerHTML = formatBigNumber(pointValue);
  });
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

function updateRedemptionForm() {
  var shownPointsEle = document.getElementById("shown-point-value");
  if (shownPointsEle) {
    var points = shownPointsEle.value;
    var redemptionPointValue = document.getElementById(
      "redemption-point-value"
    );
    if (redemptionPointValue) {
      redemptionPointValue.value = points;
    }

    if (!EasyPointsCore.Validate.pointRedemption()) {
      shownPointsEle.classList.add("invalid");
    } else {
      shownPointsEle.classList.remove("invalid");
    }
  }
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

function submitRedemptionForm() {
  updateRedemptionForm();

  if (EasyPointsCore.Validate.pointRedemption()) {
    var widgetRedemptionButton = document.getElementById('widget-redemption-button');

    if (widgetRedemptionButton) {
      widgetRedemptionButton.setAttribute('disabled', true);

      var text =
        widgetRedemptionButton.dataset.loyalTextLoading || widgetRedemptionButton.innerText;

      animateButton('widget-redemption-button', text);
    }

    updateDisplayedDiscount();
    var form = buildForm("/apps/loyalty/redeem");

    if (form) {
      submitForm(form);
      removeEasyPointsSessionItem('customerMetafieldUpdatedAt');
    }
  }
}

function updateDisplayedDiscount() {
  var pointValue = document.getElementById("shown-point-value");
  setEasyPointsSessionItem("appliedDiscount", pointValue.value);

  displayDiscount(pointValue.value.toString());
}

function submitResetForm() {
  removeEasyPointsSessionItem("appliedDiscount");
  displayDiscount("0");

  var form = buildForm("/apps/loyalty/reset");

  if (form) {
    submitForm(form);
    removeEasyPointsSessionItem('customerMetafieldUpdatedAt');
  }
}

function updateDiscountInfo() {
  var shownPointValue = document.getElementById("shown-point-value");
  if (shownPointValue) {
    shownPointValue.setAttribute("disabled", true);
  }
}

function displayDiscount(value) {
  var currencyValue = "¥";
  var currencyRatio = "1.0";
  currencyValue += formatBigNumber(value / currencyRatio).toString();

  var easyPointsSession = getEasyPointsSession();
  easyPointsSession.appliedDiscount = value;
  easyPointsSession.appliedDiscountCurrency = currencyValue;
  setEasyPointsSession(easyPointsSession);

  displayAppliedDiscount();
}

function displayAppliedDiscount() {
  var { appliedDiscount } = getEasyPointsSession();

  if (!appliedDiscount) {
    return;
  }

  EasyPointsUI.insertAppliedDiscount(appliedDiscount);

  var shownPointValue = document.getElementById('shown-point-value');
  if (shownPointValue) {
    var valueNum = appliedDiscount.toString().replace(/[^\d]/g, "");
    var valueInt = parseInt(valueNum);
    shownPointValue.value = valueInt;
  }
}

function updatePointValueTargets() {
  pointRulePercent = pointRulePointValue / pointRuleCurrencyValue;

  document.querySelectorAll('[data-loyal-target="point-value"]:not([data-loyal-block])')
    .forEach((el) => { insertPointValue(el); });
}

function updateLoyaltyTargets() {
  var easyPointsSession = getEasyPointsSession();
  var pointBalance = easyPointsSession.pointBalance;
  var expirationDate = easyPointsSession.expirationDate;

  var targetNodes = document.querySelectorAll("[data-loyal-target]");
  var targets = Array.prototype.slice.call(targetNodes);

  targets.find(function(ele) {
    var target = ele.getAttribute("data-loyal-target");

    if (target == "shop-point-rule-currency-value") {
      pointRuleCurrencyValue = pointRuleCurrencyValue || ele.value;
    } else if (target == "shop-point-rule-point-value") {
      pointRulePointValue = pointRulePointValue || ele.value;
    } else if ((typeof pointBalance == "number") && target == "balance") {
      ele.textContent = formatBigNumber(pointBalance);
    } else if (expirationDate && target == 'balance-expiration') {
      EasyPointsUI.renderBalanceExpiration(expirationDate);
    }
  });

  if (pointRulePointValue && pointRuleCurrencyValue) {
    updatePointValueTargets();
  }
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

  Locale: {
    get() {
      const defaultLocale = 'en';

      if (EasyPointsData && EasyPointsData.shop) {
        const { locale } =  EasyPointsData.shop;

        return locale || defaultLocale;
      }

      return defaultLocale;
    }
  },

  Currency: {
    getFormatOptions() {
      if (EasyPointsData && EasyPointsData.shop) {
        var { money_format_options = null } =  EasyPointsData.shop;
        return money_format_options;
      }

      return null;
    },

    getRate: function() {
      return (Shopify && Shopify.currency && Shopify.currency.rate) || 1;
    },

    getActiveString: function(fallback = 'JPY') {
      return (Shopify && Shopify.currency && Shopify.currency.active) || fallback;
    },

    format(amount, {convert = false, multiplier = 1, format = null} = {}) {
      amount = Math.round((convert ? amount * EasyPointsCore.Currency.getRate() : amount) * multiplier);
      var money = amount / 100 + ' ' + EasyPointsCore.Currency.getActiveString();

      if (Shopify && Shopify.formatMoney !== undefined && (EasyPointsData && EasyPointsData.shop.money_format || format)) {
        money = Shopify.formatMoney(amount, format || EasyPointsData.shop.money_format);
      }

      return money;
    }
  },

  Validate: {
    pointRedemption: function({points = null, balance = null, max = null} = {}) {
      var rNumbersOnly = /[^\d]/;

      if (!points) {
        var pointsInputEl = document.querySelector(EasyPointsCore.Selectors.REDEMPTION.POINTS_VALUE);

        if (!pointsInputEl) {
          return false;
        }

        if (pointsInputEl.value.match(rNumbersOnly) != null) {
          return false;
        }

        points = parseInt(pointsInputEl.value);
      }

      if (!balance) {
        var balanceText = '0';

        document.querySelectorAll(EasyPointsCore.Selectors.TARGETS.BALANCE)
          .forEach(node => balanceText = node.textContent);

        balance = parseInt(balanceText.replace(/[^\d]/g, ''));
      }

      if (!max) {
        var pointsMaxEl = document.querySelector(EasyPointsCore.Selectors.REDEMPTION.POINTS_MAX);

        if (!pointsMaxEl) {
          return false;
        }

        if (pointsMaxEl.value.match(rNumbersOnly) != null) {
          return false;
        }

        max = parseInt(pointsMaxEl.value);
      }

      max = max / (100 * EasyPointsCore.Currency.getRate());
      max *= 1.0;
      max = Math.floor(max);

      return 0 < points && points <= Math.min(balance, max);
    }
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
        submitForm(form);
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
            return (tier.raw_amount * (100 * EasyPointsCore.Currency.getRate())) > subtotal;
          });

      if (nextTier) {
        return {
          name: nextTier.name,
          advancementAmountRaw: nextTier.raw_amount,
          advancementAmountMultiplied: (nextTier.raw_amount * (100 * EasyPointsCore.Currency.getRate())) - subtotal,
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

  insertAppliedDiscount: function(discount) {
    var formatOptions =
      EasyPointsCore.Currency.getFormatOptions() || { convert: true, multiplier: 100 };

    document.querySelectorAll(EasyPointsCore.Selectors.TARGETS.APPLIED_DISCOUNT)
      .forEach(el => el.innerHTML = EasyPointsCore.Currency.format(discount, formatOptions));
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
  var easyPointsSession = getEasyPointsSession();
  var appliedDiscount = easyPointsSession.appliedDiscount;

  if (appliedDiscount && parseInt(appliedDiscount) > 0) {
    displayAppliedDiscount();
    updateDiscountInfo();
  }

  updateLoyaltyTargets();

  var shownPointValue = document.getElementById("shown-point-value");
  if (shownPointValue) {
    shownPointValue.addEventListener("change", updateRedemptionForm);

    shownPointValue.addEventListener("focus", function() {
      shownPointValue.setAttribute("placeholder", "");
    });

    shownPointValue.addEventListener("blur", function() {
      shownPointValue.setAttribute("placeholder", "0");
    });
  }

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
      staleSessionKey('shopMetafieldUpdatedAt', easyPointsSession)
    )) {
      var data = {};
      var route = "/apps/loyalty/order_point_rule";

      if (custId) {
        route = route + "/" + custId;
      }

      var params = new URLSearchParams();
      var xhr = new XMLHttpRequest();
      xhr.open("GET", route + "?" + params.toString());

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

          if (!(custId)) {
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
        var currencyCost = parseInt(ele.dataset.loyalCurrencyCost) / (100 * EasyPointsCore.Currency.getRate());
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

  function fetchAndUpdatePointBalance(force = false) {
    if (custId && shopDomain) {
      var easyPointsSession = getEasyPointsSession();

      if (force || staleSessionKey("customerMetafieldUpdatedAt", easyPointsSession)) {
        var params = new URLSearchParams({ sid: custId });
        var xhr = new XMLHttpRequest();
        xhr.open("GET", `/apps/loyalty/point_balances/${custId}?` + params.toString());

        xhr.onload = function() {
          if (xhr.status === 200) {
            var resp = JSON.parse(xhr.response);
            easyPointsSession.pointBalance = resp.balance;
            easyPointsSession.expirationDate = resp.expiration_date;

            if (typeof resp.coupon_value === "number" && resp.coupon_value > 0) {
              easyPointsSession.appliedDiscount = resp.coupon_value;
              easyPointsSession.appliedDiscountCurrency = resp.coupon_currency;
            } else {
              delete easyPointsSession.appliedDiscount;
              delete easyPointsSession.appliedDiscountCurrency;
            }

            easyPointsSession.customerMetafieldUpdatedAt = new Date();
            setEasyPointsSession(easyPointsSession);
            updatePointBalance(easyPointsSession);
          }
        };

        xhr.send();
      }
    }
  }

  function updatePointBalance(easyPointsSession = null) {
    easyPointsSession = easyPointsSession || getEasyPointsSession();

    document.body.querySelectorAll('[data-loyal-target="balance"]:not([data-loyal-block])')
      .forEach(function(balanceField) {
        balanceField.textContent = formatBigNumber(easyPointsSession.pointBalance);
      });

    EasyPointsUI.renderBalanceExpiration(easyPointsSession.expirationDate);

    var maxRedeemablePoints = document.getElementById("max-redeemable-points");

    if (maxRedeemablePoints) {
      var orderTotal = parseInt(
        maxRedeemablePoints.textContent.replace(/[^\d]/g, "")
      );

      maxRedeemablePoints.textContent = formatBigNumber(
        Math.min(orderTotal, easyPointsSession.pointBalance)
      );
    }

    if (typeof easyPointsSession.appliedDiscount === "number" && easyPointsSession.appliedDiscount > 0) {
      var displayRedemptionField = document.getElementById(
        "shown-point-value"
      );

      if (displayRedemptionField) {
        displayRedemptionField.value = easyPointsSession.appliedDiscount;
      }

      var trueRedemptionField = document.getElementById(
        "redemption-point-value"
      );

      if (trueRedemptionField) {
        trueRedemptionField.value = easyPointsSession.appliedDiscount;
      }

      EasyPointsUI.insertAppliedDiscount(easyPointsSession.appliedDiscount);

      updateDiscountInfo();
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
  async(fetchAndUpdatePointBalance);
  async(fetchOrderDetails);
});
