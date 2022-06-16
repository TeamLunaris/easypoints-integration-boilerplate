/**
 * v1.9
 *
 * Required functions from `easy_points.js`
 *  - updateLoyaltyTargets/0
 *  - updateDisplayedDiscount/0
 *  - displayDiscount/1
 *  - formatBigNumber/1
 *  - insertPointValue/1
 */

 window.addEventListener('DOMContentLoaded', function() {
  var path = this.window.location.pathname;
  var re = /\/cart/i;

  if (!path.match(re)) {
    return;
  }

  EasyPoints.reset({});
  EasyPoints.Register.run();

  // var cartNode = document.querySelector('form[action="/cart"]');

  // if (cartNode) {
  //   var callback = function(mutationsList, observer) {
  //     for (var mutation of mutationsList) {
  //       if (mutation.type === 'childList' && mutation.target == cartNode) {
  //         EasyPoints.reset({});

  //         document.querySelectorAll('[data-loyal-target="subtotal"]')
  //           .forEach(node => {
  //             var price = EasyPoints.Points.getPriceFromEl(node, '[data-loyal-target="total_price"]');
  //             EasyPoints.Points.setCurrencyCost(
  //               node.querySelector('[data-loyal-target="point-value"]'),
  //               { price: price }
  //             );
  //           });

  //         EasyPoints.Points.resetTargets();
  //         EasyPoints.Cart.setRedemptionForm();

  //         break;
  //       }
  //     }
  //   };

  //   (new MutationObserver(callback))
  //     .observe(cartNode, {
  //       attributes: false,
  //       childList: true,
  //       subtree: true
  //     });
  // }
});

var EasyPoints = {

  Debug: {
    DEBUG: true,

    print: function(msg, type = 'info') {
      if (!this.DEBUG) {
        return;
      }

      msg = "[EasyPoints] " + msg

      switch (type.toLowerCase()) {
        case 'warn':
          console.warn(msg);
          break;
        case 'error':
          console.error(msg);
          break;
        default:
          console.info(msg);
          break;
      }
    }
  },

  Selectors: {
    getElementBy$: function(element, selector, nodes = false) {
      var element =
        nodes ? element.querySelectorAll(selector) : element.querySelector(selector);

      if (!element) {
        EasyPoints.Debug.print('Could not locate ' + selector, 'warn');
      }

      return element;
    },

    getTotalPointsEl: function(el, nodes = false) {
      return this.getElementBy$(el, '[data-loyal-target="total-points-value"]', nodes);
    },

    getRedeemContainerEl: function(element, nodes = false) {
      return this.getElementBy$(element, '.easy-points-form__container', nodes);
    },

    getRedeemPointsButtonEl: function(element, nodes = false) {
      return this.getElementBy$(element, '.easy-points-button__redeem', nodes);
    },

    getResetPointsButtonEl: function(element, nodes = false) {
      return this.getElementBy$(element, '.easy-points-button__reset', nodes);
    },

    getRedeemPointsInputEl: function(element, nodes = false) {
      return this.getElementBy$(element, '.easy-points-form__input input', nodes);
    },

    getCheckoutButtonEl: function(element, nodes = false) {
      return this.getElementBy$(element, '[type="submit"][name="checkout"]', nodes);
    },

    getAdditionalCheckoutButtonEl: function(element, nodes = false) {
      return this.getElementBy$(element, '.additional-checkout-buttons', nodes);
    }
  },

  Points: {
    getExcludedCost() {
      var excluded =
        Array.from(document.querySelectorAll('[data-loyal-target="point-exclusion"]'))
          .reduce((acc, node) => acc + parseInt(node.dataset.loyalCurrencyCost), 0);

      return excluded;
    },

    getTotalBonusPoints(el = document) {
      var total =
        Array.from(el.querySelectorAll('[data-loyal-bonus-points]'))
          .reduce((acc, node) => {
            var { bonusPoints } = JSON.parse(node.dataset.loyalBonusPoints);
            bonusPoints = parseInt(bonusPoints);

            if (!isNaN(bonusPoints) && bonusPoints > 0) {
              return acc + bonusPoints;
            }

            return acc;
          }, 0);

      return total;
    },

    insertTotalPoints(el, { ignoreExcluded = false, ignoreTax = false } = {}) {
      EasyPoints.Selectors.getTotalPointsEl(el, true)
        .forEach(node => {
          var { tax } = JSON.parse(node.dataset.loyalOpts);
          var total = parseInt(node.dataset.loyalCurrencyCost);

          if (!tax.awardable || !tax.included) {
            var pointEls = [
              ...document.querySelectorAll('[data-loyal-target="point-value"]')
            ];

            // calculate the total price from all cart item point values
            // must use the `item.final_price` otherwise qty must be ignored
            // {% render 'points', item: item, price: item.final_price %}

            total = pointEls.reduce((acc, pointEl) => {
              var { loyalCurrencyCost: cost, loyalQuantity: qty } = pointEl.dataset;
              return (cost * qty) + acc;
            }, 0);
          }

          if (!ignoreExcluded) {
            total -= EasyPoints.Points.getExcludedCost();
          }

          EasyPoints.Points.setCurrencyCost(node, { price: Math.floor(total), ignoreTax: tax.awardable });
          insertPointValue(node);

          var totalPoints = parseInt(node.innerText.replace(/\D/g, ''));

          // hack: some themes innerText returns empty string
          if (isNaN(totalPoints)) {
            totalPoints = parseInt(node.textContent.replace(/\D/g, ''));
          }

          totalPoints += Math.round(EasyPoints.Points.getTotalBonusPoints(el));
          insertPointValueIntoElement(node, totalPoints);
        });
    },

    getPriceFromEl: function(element, selector = null, regex = /[^\d]/g) {
      var el = selector ? element.querySelector(selector) : element;

      if (el) {
        return parseInt(el.textContent.replace(regex, '')) * 100;
      }

      return null;
    },

    getTaxedCost: function({price, tax}, el = null) {
      if (el !== null && el.dataset.loyalOpts) {
        var opts = JSON.parse(el.dataset.loyalOpts);
        tax = opts.tax
      }

      if (tax === null) {
        EasyPoints.Debug.print('Tax object not defined.', 'error');
        return price;
      }

      if (tax.included) {
        return price;
      }

      return tax.exempt ? price : Math.floor(price * tax.rate);
    },

    setCost(node, attribute, {price = null, multiplier = 1, ignoreTax = false}) {
      price = (price !== null ? price : parseInt(node.dataset.loyalCurrencyCost)) * multiplier;

      if (price <= 0) {
        node.setAttribute(attribute, 0);
        return;
      }

      if (node.dataset.loyalOpts) {
        var opts = JSON.parse(node.dataset.loyalOpts);

        if (!ignoreTax) {
          price = this.getTaxedCost({price: price, tax: opts.tax});
        }
      }

      node.setAttribute(attribute, price);
    },

    setCurrencyCost(node, opts) {
      this.setCost(node, 'data-loyal-currency-cost', opts)
    },

    /**
     * Resets all `[data-loyal-target="point-value"]` targets to their original values.
     * Original values are calculated through options on the element.
     */
    resetTargets: function(priceOptions = {}, callback = null, container = null) {
      var selector = container != null
        ? container + ' [data-loyal-target="point-value"]'
        : '[data-loyal-target="point-value"]';

      document
        .querySelectorAll(selector)
        .forEach(node => {
          // ignore total points
          if (node.classList.contains('points-after-applied-discount')) {
            return;
          }

          this.setCurrencyCost(node, priceOptions)
        });

      if (callback) {
        callback();
      } else {
        updateLoyaltyTargets();
      }
    }
  },

  Cart: {
    url: function() {
      return window.location.origin + '/cart.json';
    },

    getFromJSON: function(callback) {
      var req = new XMLHttpRequest();

      req.onreadystatechange = function() {
        if(req.readyState === XMLHttpRequest.DONE) {
          var status = req.status;

          if (status === 0 || (status >= 200 && status < 400)) {
            callback(JSON.parse(req.responseText));
          } else {
            EasyPoints.Debug.print('Failed getting data from /cart.json', 'error');
          }
        }
      };

      req.open('GET', this.url());
      req.setRequestHeader('accept', 'application/json');
      req.send();
    },

    setRedemptionForm: function() {
      this.getFromJSON(function(cart) {
        var form = document.getElementById('point-redemption-form');

        if (form) {
          if (maxRedeemableInput = form.querySelector('input[name="coupon[max_redeemable]"]')) {
            maxRedeemableInput.value = cart.total_price;
          }

          cart.items.forEach(function(item) {
            var inputs = form.querySelectorAll('input[name="coupon[product_ids][]"]');
            var exists = Array.prototype.find.call(inputs, function (el) {
              return el.value == item.product_id;
            });

            if (!exists) {
              var input = document.createElement('input');
              input.setAttribute('type', 'hidden');
              input.setAttribute('name', 'coupon[product_ids][]');
              input.setAttribute('value', item.product_id);
              form.appendChild(input);

              EasyPoints.Debug.print('New cart item input created for the submission form.');
            }
          });
        }
      });
    }
  },

  UI: {
    showHidden: function() {
      EasyPoints.Selectors.getElementBy$(document, '.hidden-unless-discount-applied', true)
        .forEach(node => node.classList.remove('easy-points-hide'));
    },

    hideHidden: function() {
      EasyPoints.Selectors.getElementBy$(document, '.hidden-unless-discount-applied', true)
        .forEach(node => node.classList.add('easy-points-hide'));
    },

    cloneSubtotal: function() {
      EasyPoints.Selectors.getElementBy$(document, '[data-loyal-target="subtotal"]', true)
        .forEach(node => {
          var clone = node.cloneNode(true);
          clone.removeAttribute('data-loyal-target');
          clone.setAttribute('data-loyal-clone', 'subtotal');

          node.classList.add('easy-points-hide');
          node.insertAdjacentElement('beforebegin', this.modifySubtotal(clone));
        });
    },

    resetClonedSubtotal: function() {
      EasyPoints.Selectors.getElementBy$(document, '[data-loyal-clone]', true)
        .forEach(node => node.remove());

      EasyPoints.Selectors.getElementBy$(document, '[data-loyal-target="subtotal"]', true)
        .forEach(node => node.classList.remove('easy-points-hide'));
    },

    modifySubtotal: function(el) {
      var priceEl = el.querySelector('[data-loyal-target="total_price"]');

      if (!priceEl) {
        EasyPoints.Debug.print('modifySubtotal(el): missing total price target.');
        return el;
      }

      var discount = EasyPoints.getDiscountSession();
      var subtotal = priceEl.dataset.loyalTotalPrice;

      var { multiplier } = EasyPointsCore.Currency.getFormatOptions() || { multiplier: 100 };
      var discountNoDecimal = Math.round(discount * EasyPointsCore.Currency.getRate() * multiplier)
      var cost = subtotal - discountNoDecimal;

      if (cost >= 0) {
        priceEl.innerHTML = EasyPointsCore.Currency.format(cost);

        var totalPointsEl = el.querySelector('.points-after-applied-discount');
        if (totalPointsEl) {
          var totalPoints = parseInt(totalPointsEl.innerText.replace(/\D/g, ''));
          var subtotalTaxed = EasyPoints.Points.getTaxedCost({price: subtotal, tax: null}, totalPointsEl);
          var costTaxed = EasyPoints.Points.getTaxedCost({price: cost, tax: null}, totalPointsEl);

          insertPointValueIntoElement(
            totalPointsEl,
            formatBigNumber(
              Math.max(0, Math.ceil((costTaxed / subtotalTaxed) * totalPoints))
            )
          );
        }
      }

      return el;
    },

    showDiscount: function() {
      this.showHidden();
      this.buttonReset();
    },

    hideDiscount: function() {
      this.hideHidden();
      this.buttonRedeem();
    },

    buttonRedeem: function() {
      EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
        .forEach(node => node.removeAttribute('disabled'));

      EasyPoints.Selectors.getResetPointsButtonEl(document, true)
        .forEach(node => node.classList.add('easy-points-hide'));

      EasyPoints.Selectors.getRedeemPointsButtonEl(document, true)
        .forEach(node => node.classList.remove('easy-points-hide'));
    },

    buttonReset: function() {
      EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
        .forEach(pointsInput => {
          pointsInput.setAttribute('disabled', true);

          var discount = EasyPoints.getDiscountSession();

          if (
            !pointsInput.classList.contains('valid') &&
            (pointsInput.value == '' || pointsInput.value <= 0) && discount > 0) {
            pointsInput.value = discount;
          }
        });

      EasyPoints.Selectors.getResetPointsButtonEl(document, true)
        .forEach(node => node.classList.remove('easy-points-hide'));

      EasyPoints.Selectors.getRedeemPointsButtonEl(document, true)
        .forEach(node => node.classList.add('easy-points-hide'));
    }
  },

  Tiers: {
    recalculate: function(subtotal = null) {
      var { rankAdvancementData } = getEasyPointsSession();

      if (!rankAdvancementData || rankAdvancementData.raw_amount >= 0) {
        return;
      }

      var discount = EasyPoints.getDiscountSession();
      var { multiplier } = EasyPointsCore.Currency.getFormatOptions() || { multiplier: 100 };
      var discountNoDecimal = Math.round(discount * EasyPointsCore.Currency.getRate() * multiplier)

      if (subtotal === null) {
        var priceEl = document.querySelector('[data-loyal-target="total_price"]');

        if (!priceEl) {
          EasyPoints.Debug.print('recalculate(el): missing total price target.', 'error');
          return;
        }

        subtotal = priceEl.dataset.loyalTotalPrice;
      }

      try {
        var nextTier = EasyPointsCore.Tiers.getNextTier(subtotal - discountNoDecimal);

        if (nextTier) {
          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="rank-advancement-tier-name"]')
          ).forEach((target) =>  {
            target.textContent = nextTier.name;
          });

          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="rank-advancement-amount"]')
          ).forEach((target) => {
            target.innerHTML = EasyPointsCore.Currency.format(nextTier.advancementAmountMultiplied);
          });
        } else {
          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="rank-advancement-data"] > span')
          ).forEach((target) => {
            target.style.display = target.dataset.loyalTarget == 'max-rank'
              ? ''
              : 'none';
          });
        }
      } catch {
        EasyPoints.Debug.print('EasyPoints Tiers: error getting next tier.', 'error')
        return;
      }
    },
  },

  getDiscountSession: function() {
    var discount = sessionStorage.getItem("appliedDiscount");

    return discount ? parseInt(discount) : 0;
  },

  applyDiscount: function() {
    var discount = this.getDiscountSession();

    EasyPoints.Debug.print('Applying discount: ' + discount);

    if (discount > 0) {
      displayDiscount(discount);

      EasyPoints.UI.showDiscount();
      EasyPoints.UI.cloneSubtotal();
      EasyPoints.Selectors.getAdditionalCheckoutButtonEl(document, true)
        .forEach(node => node.classList.add('easy-points-hide'));
    }
  },

  reset: function({event = null}) {
    EasyPoints.UI.hideDiscount();
    EasyPoints.UI.resetClonedSubtotal();
    EasyPoints.Selectors.getAdditionalCheckoutButtonEl(document, true)
        .forEach(node => node.classList.remove('easy-points-hide'));

    sessionStorage.removeItem('appliedDiscount');

    EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
      .forEach(node => node.value = '');
  },

  Form: {
    update({points}) {
      var input = EasyPoints.Selectors.getElementBy$(document, '#redemption-point-value');

      if (!input) {
        sessionStorage.removeItem('appliedDiscount');
        return false;
      }

      input.value = points;

      if (!EasyPointsCore.Validate.pointRedemption()) {
        sessionStorage.removeItem('appliedDiscount');

        EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
          .forEach(node => node.classList.add('invalid'));

        return false;
      } else {
        sessionStorage.setItem('appliedDiscount', points);

        EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
          .forEach(node => node.classList.remove('invalid'));

        return true;
      }
    },

    redeem({event = null, points = null}) {
      if (points == null) {
        if (event == null) {
          EasyPoints.Debug.print('redeem({event, points}): cant get the points value', 'error')
          return false;
        }

        var form = event.target.closest('.easy-points-form__container');

        if (!form) {
          EasyPoints.Debug.print('redeem({event, points}): target form is not defined');
          return false;
        }

        if (input = EasyPoints.Selectors.getRedeemPointsInputEl(form)) {
          input.value = input.value.toString().replace(/[^\d]/g, '');
          points = input.value;
        }
      }

      return this.update({points: points});
    },

    setCoupon(callback = null, reset = null) {
      if ((reset != null && !reset) || EasyPoints.getDiscountSession() > 0) {
        EasyPoints.Debug.print('Using /redeem')
        form = buildForm('/apps/loyalty/redeem');
      } else {
        EasyPoints.Debug.print('Using /reset')
        form = buildForm('/apps/loyalty/reset');
      }

      if (form) {
        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function(event) {
          if (this.readyState == 4) {
            EasyPoints.Debug.print('Submitted');

            if (callback) {
              callback();
            }
          }
        };

        xhr.open('POST', form.action);
        var formData = new FormData(form);
        xhr.send(formData);

        EasyPoints.Debug.print('Submitting form');
      } else {
        if (callback) {
          callback();
        }
      }
    },
  },

  Register: {
    submissionReady: false,

    run: function() {
      updateLoyaltyTargets();
      EasyPoints.Points.insertTotalPoints(document);
      EasyPoints.Tiers.recalculate()

      this.setEventListeners();
      EasyPoints.applyDiscount();
    },

    setEventListeners: function() {
      if (EasyPoints.Selectors.getRedeemContainerEl(document, true).length == 0) {
        return;
      }

      EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
        .forEach(node => {
          node.addEventListener('focus', this.onPointsInput);

          if (node.value > 0) {
            EasyPoints.Form.update({points: EasyPoints.getDiscountSession()});
          }
        });

      EasyPoints.Selectors.getRedeemPointsButtonEl(document, true)
        .forEach(node => node.addEventListener('click', this.onClickRedeemBtn));

      EasyPoints.Selectors.getResetPointsButtonEl(document, true)
        .forEach(node => node.addEventListener('click', this.onClickResetBtn));

      EasyPoints.Selectors.getCheckoutButtonEl(document, true)
        .forEach(node => node.addEventListener('click', this.onClickSetCoupon));

      EasyPoints.Debug.print('Applied all required event listeners');
    },

    onPointsInput: function(e) {
      e.target.classList.remove('invalid');
    },

    onClickRedeemBtn: function(e) {
      e.preventDefault();
      EasyPoints.Debug.print('Clicked: Redeem');

      EasyPoints.Register.submissionReady = false;
      if (EasyPoints.Form.redeem({event: e})) {
        EasyPoints.applyDiscount();
      }
    },

    onClickResetBtn: function(e) {
      e.preventDefault();
      EasyPoints.Debug.print('Clicked: Reset');

      EasyPoints.Register.submissionReady = false;
      EasyPoints.reset({event: e});
    },

    onClickSetCoupon(e, callback = null) {
      EasyPoints.Debug.print('Clicked: checkout');

      if (EasyPoints.Register.submissionReady) {
        EasyPoints.Debug.print('> ready to checkout');
        return;
      }

      EasyPoints.Debug.print('Setting coupon');
      e.preventDefault();
      e.stopPropagation();

      checkoutBtn = e.target;
      checkoutBtn.style.cursor = 'progress';
      checkoutBtn.classList.add('btn--loading');
      checkoutBtn.setAttribute('disabled', true);

      EasyPoints.Form.setCoupon(
        function() {
          EasyPoints.Register.submissionReady = true;

          checkoutBtn.style.cursor = 'unset';
          checkoutBtn.classList.remove('btn--loading');
          checkoutBtn.removeAttribute('disabled');
          checkoutBtn.click();

          if (callback) {
            callback();
          }
        }
      )
    }
  }
};
