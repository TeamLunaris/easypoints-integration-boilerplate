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

function htmlRedirectInput() {
  var input = document.createElement("input");
  input.type = "text";
  input.setAttribute("name", "html_redirect");
  input.value = "true";
  return input;
}

function buildForm(action, formId) {
  var virtualForm = document.getElementById(formId);
  if (virtualForm) {
    var inputs = Array.from(virtualForm.getElementsByTagName("input"));

    var form = document.createElement("form");
    form.method = "post";
    form.action = action;

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

  Note: {
    submit(e) {
      var btn = e.target;
      if (btn) {
        btn.setAttribute('disabled', true);
        btn.style.cursor = 'progress';
      }

      var form = buildForm('/apps/loyalty/customers', 'easypoints-note-update');
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
};

var EasyPointsUI = {
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
};

window.addEventListener('DOMContentLoaded', function() {
  EasyPointsUI.Note.addSubmitListener();
  EasyPointsUI.Note.addValuesChangedListener();

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
