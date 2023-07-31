/**
 * v1.91
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

  EasyPoints.Register.run();


  EasyPoints.removeDiscount();


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

    /**
     * The `getElementBy$` method queries an element (or elements, if `nodes` is true) that matches a specified selector.
     *
     * @param {HTMLElement} element - The root element to start the search from.
     * @param {string} selector - A DOMString containing one or more selectors to match.
     * @param {boolean} [nodes=false] - If true, the method will return all matching elements, otherwise it will return the first matching element.
     * @returns {HTMLElement | NodeList | null} - Returns the first matching element if `nodes` is false, a NodeList of matching elements if `nodes` is true, or null if no match is found.
     */
    getElementBy$: function (element, selector, nodes = false) {
      var element =
        nodes ? element.querySelectorAll(selector) : element.querySelector(selector);

      if (!element) {
        EasyPoints.Debug.print('Could not locate ' + selector, 'warn');
      }

      return element;
    },

    /**
     * @param {HTMLElement} element - The root element to start the search from.
     * @param {boolean} [nodes=false] - If true, the method will return all matching elements with attribute data-loyal-target equals to "total-points-value", otherwise it will return the first matching element.
     * @returns {HTMLElement | NodeList | null} - Returns the first matching element if `nodes` is false, a NodeList of matching elements if `nodes` is true, or null if no match is found.
     */
    getTotalPointsEl: function (element, nodes = false) {
      return this.getElementBy$(
        element,
        '[data-loyal-target="total-points-value"]',
        nodes
      );
    },

    getRedeemContainerEl: function (element, nodes = false) {
      return this.getElementBy$(element, '.easy-points-form__container', nodes);
    },

    getRedeemPointsButtonEl: function (element, nodes = false) {
      return this.getElementBy$(element, '.easy-points-button__redeem', nodes);
    },

    getResetPointsButtonEl: function (element, nodes = false) {
      return this.getElementBy$(element, '.easy-points-button__reset', nodes);
    },

    getRedeemPointsInputEl: function (element, nodes = false) {
      return this.getElementBy$(element, '.easy-points-form__input input', nodes);
    },

    getCheckoutButtonEl: function (element, nodes = false) {
      return this.getElementBy$(element, '[type="submit"][name="checkout"]', nodes);
    },

    getAdditionalCheckoutButtonEl: function (element, nodes = false) {
      return this.getElementBy$(element, '.additional-checkout-buttons', nodes);
    },
  },

  Points: {

    /**
     * Retrieves the total costs that are excluded from loyalty points calculation.
     *
     * @returns {number} - The total excluded cost.
     */
    getExcludedCost() {
      var excluded = Array.from(
        document.querySelectorAll('[data-loyal-target="point-exclusion"]')
      ).reduce(
        (acc, node) => acc + parseInt(node.dataset.loyalCurrencyCost),
        0
      );

      return excluded;
    },

    /**
     * Retrieves the total bonus points available in the document or the given element.
     *
     * @param {HTMLElement} [el=document] - The root element to start the search from.
     * @returns {number} - The total bonus points.
     */
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

    /**
     * Inserts total loyalty points to all matching elements within the container.
     *
     * @param {HTMLElement} containerEl - The container within which to search for elements.
     */
    insertTotalPoints(containerEl) {
      EasyPoints.Selectors.getTotalPointsEl(containerEl, true)
        .forEach(node => {
          var ignoreTax = false;
          var { tax } = JSON.parse(node.dataset.loyalOpts);
          var total = parseInt(node.dataset.loyalCurrencyCost);

          if (!tax.awardable || !tax.included) {
            var pointEls = [
              ...document.querySelectorAll('[data-loyal-target="point-value"]')
            ];

            // calculate the total price from all cart item point values
            // must use the `item.final_price` otherwise qty must be ignored
            // {% render 'points', item: item, price: item.final_price %}

            // ignore tax because we calculate total cost from all point values on the page
            ignoreTax = true;

            total = pointEls.reduce((acc, pointEl) => {
              var { loyalCurrencyCost: cost, loyalQuantity: qty } = pointEl.dataset;
              return (cost * qty) + acc;
            }, 0);
          }

          total -= EasyPoints.Points.getExcludedCost();

          EasyPoints.Points.setCurrencyCost(node, { price: Math.floor(total), ignoreTax: ignoreTax });
          insertPointValue(node);

          var totalPoints = parseInt(node.innerText.replace(/\D/g, ''));

          // hack: some themes innerText returns empty string
          if (isNaN(totalPoints)) {
            totalPoints = parseInt(node.textContent.replace(/\D/g, ''));
          }

          totalPoints += Math.round(EasyPoints.Points.getTotalBonusPoints(containerEl));
          insertPointValueIntoElement(node, totalPoints);
        });
    },

    /**
     * Retrieves the price from a given element or from an element matching the given selector within it.
     *
     * @param {HTMLElement} element - The root element to start the search from.
     * @param {string} [selector=null] - A CSS selector to further specify the element to search from.
     * @param {RegExp} [regex=/[^\d]/g] - A regex to clean the price text.
     * @returns {number | null} - The price found, or null if no price could be found.
     */
    getPriceFromEl: function (element, selector = null, regex = /[^\d]/g) {
      var el = selector ? element.querySelector(selector) : element;

      if (el) {
        return parseInt(el.textContent.replace(regex, '')) * 100;
      }

      return null;
    },

    /**
     * Retrieves the cost including tax, if applicable.
     *
     * @param {Object} params - The object containing price and tax details.
     * @param {number} params.price - The base price.
     * @param {Object} params.tax - The tax details.
     * @param {HTMLElement} [el=null] - An optional element from which to retrieve tax information if not provided in `params`.
     * @returns {number} - The cost including tax if applicable, or the original price if not.
     */
    getTaxedCost: function ({ price, tax }, el = null) {
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

    /**
     * Sets the cost attribute for a given node.
     *
     * @param {HTMLElement} node - The element to set the attribute on.
     * @param {string} attribute - The attribute to set.
     * @param {Object} params - The object containing price details and configuration.
     * @param {number} [params.price=null] - The price to set, or null to use the existing price on the node.
     * @param {number} [params.multiplier=1] - The multiplier to apply to the price.
     * @param {boolean} [params.ignoreTax=false] - Whether to ignore tax when calculating the price.
     */
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

    /**
     * Sets the "data-loyal-currency-cost" attribute for a given node.
     *
     * @param {HTMLElement} node - The element to set the attribute on.
     * @param {Object} opts - The object containing price details and configuration, as passed to `setCost`.
     */
    setCurrencyCost(node, opts) {
      this.setCost(node, 'data-loyal-currency-cost', opts)
    },

    /**
     * Resets all `[data-loyal-target="point-value"]` targets to their original values.
     * Original values are calculated through options on the element.
     *
     * @param {Object} [priceOptions={}] - Options for calculating the original price.
     * @param {function} [callback=null] - An optional callback function to call after resetting all targets.
     * @param {string} [container=null] - An optional CSS selector string of the container within which to search for targets.
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

    /**
     * Returns the URL for the cart in JSON format.
     *
     * @returns {string} - The URL for the cart in JSON format.
     */
    url: function() {
      return window.location.origin + '/cart.json';
    },

    /**
     * Fetches the cart's content from /cart.json and executes a callback function with the result.
     *
     * @param {function} callback - The function to call with the cart's data when the request completes.
     */
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

    /**
     * Fetches the cart's content from /cart.json and populates a form with data about the cart items.
     */
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

    /**
     * Shows all the elements with class 'hidden-unless-discount-applied'.
     */
    showHidden: function() {
      EasyPoints.Selectors.getElementBy$(document, '.hidden-unless-discount-applied', true)
        .forEach(node => node.classList.remove('easy-points-hide'));
    },

    /**
     * Hides all the elements with class 'hidden-unless-discount-applied'.
     */
    hideHidden: function() {
      EasyPoints.Selectors.getElementBy$(document, '.hidden-unless-discount-applied', true)
        .forEach(node => node.classList.add('easy-points-hide'));
    },

    /**
     * Clones the element(s) with '[data-loyal-target="subtotal"]' and hides original element(s).
     */
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

    /**
     * Removes all cloned 'subtotal' elements and shows the original 'subtotal' elements.
     */
    resetClonedSubtotal: function() {
      EasyPoints.Selectors.getElementBy$(document, '[data-loyal-clone]', true)
        .forEach(node => node.remove());

      EasyPoints.Selectors.getElementBy$(document, '[data-loyal-target="subtotal"]', true)
        .forEach(node => node.classList.remove('easy-points-hide'));
    },

    /**
     * Modifies 'subtotal' element, updating the total price based on the discount.
     *
     * @param {HTMLElement} el - The root element to start the search from.
     * @returns {HTMLElement} - The modified 'subtotal' element.
     */
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

    /**
     * Executes functions to show the discount in the UI.
     */
    showDiscount: function() {
      this.showHidden();
      this.buttonReset();
    },

    /**
     * Executes functions to revert the UI to where no discount is applied.
     */
    hideDiscount: function() {
      this.hideHidden();
      this.buttonRedeem();
    },

    /**
     * Enables the 'Redeem Points' input and shows the 'Redeem Points' button while hiding the 'Reset' button.
     */
    buttonRedeem: function() {
      EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
        .forEach(node => node.removeAttribute('disabled'));

      EasyPoints.Selectors.getResetPointsButtonEl(document, true)
        .forEach(node => node.classList.add('easy-points-hide'));

      EasyPoints.Selectors.getRedeemPointsButtonEl(document, true)
        .forEach(node => node.classList.remove('easy-points-hide'));
    },

    /**
     * Disables and hides the 'Redeem Points' input, and shows the 'Reset' button.
     */
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

    /**
     * Recalculates the next tier rank and updates the associated HTML elements accordingly.
     * This function also handles the case where the next tier is not present (maximum tier reached).
     *
     * @param {number|null} [subtotal=null] - The subtotal amount used to calculate the next tier. If null, the function will attempt to retrieve it from an HTML element.
     */
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

  /**
   * Retrieves the applied discount value from the session storage.
   * @return {number} The applied discount value, or 0.
   */
  getDiscountSession: function() {
    var discount = sessionStorage.getItem("appliedDiscount");

    return discount ? parseInt(discount) : 0;
  },

  /**
   * Removes the applied discount if it's greater than 0. Disables the checkout and reset buttons during the process.
   */
  removeDiscount: function() {
    if (this.getDiscountSession() > 0) {
      EasyPoints.Debug.print('Removing discount');
      var checkoutBtn = EasyPoints.Selectors.getCheckoutButtonEl(document, true);
      var resetBtn = EasyPoints.Selectors.getResetPointsButtonEl(document);

      resetBtn.setAttribute('disabled', true);
      checkoutBtn.forEach((node) => node.setAttribute('disabled', true));

      EasyPoints.Form.setCoupon(
        function() {
          EasyPoints.reset({});

          resetBtn.removeAttribute('disabled');
          checkoutBtn.forEach((node) => node.removeAttribute('disabled'));
        }
      )
    }
  },

  /**
   * Applies the discount from session storage if it's greater than 0. Updates the UI accordingly.
   */
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

  /**
   * Resets the applied discount, updates the UI, and clears the discount from the session storage.
   * @param {Object} options The options for the reset.
   * @param {Event} [options.event=null] The event that triggered the reset, if applicable.
   */
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

    /**
     * Updates the value of redemption points input and validates it. Also, updates the session storage accordingly.
     *
     * @param {Object} options The options for the update.
     * @param {number} options.points The new value for the points input.
     * @returns {boolean} Whether the update was successful.
     */
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

    /**
     * Redeems the given points or the points value from the event's related form.
     *
     * @param {Object} options The options for the redemption.
     * @param {Event} [options.event=null] The event that triggered the redemption, if applicable.
     * @param {number} [options.points=null] The points to redeem, if provided.
     * @returns {boolean} Whether the redemption was successful.
     */
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

    /**
     * Sets a coupon using the given endpoints based on the value of reset and the discount session.
     * Executes the provided callback function after the AJAX request is completed.
     *
     * @param {function} [callback=null] The function to call after the AJAX request is completed.
     * @param {boolean} [reset=null] The flag to indicate whether to reset the coupon.
     */
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

    /**
     * Run the registration process by updating the loyalty targets,
     * inserting the total points, recalculating tiers, setting up event listeners,
     * and applying any discount.
     */
    run: function() {
      updateLoyaltyTargets();
      EasyPoints.Points.insertTotalPoints(document);
      EasyPoints.Tiers.recalculate()

      this.setEventListeners();
      EasyPoints.applyDiscount();
    },

    /**
     * Set up the necessary event listeners for redeeming points and resetting the form.
     */
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

      EasyPoints.Debug.print('Applied all required event listeners');
    },

    /**
     * Handler for the 'focus' event on the points input.
     * Removes the 'invalid' class from the input field.
     *
     * @param {Event} e - The event object.
     */
    onPointsInput: function(e) {
      e.target.classList.remove('invalid');
    },

    /**
     * Handler for the 'click' event on the Redeem button.
     * If the form passes validation, it sets a loading cursor, disables the button,
     * applies the discount, and then reverts the cursor and re-enables the button.
     *
     * @param {Event} e - The event object.
     */
    onClickRedeemBtn: function(e) {
      e.preventDefault();
      EasyPoints.Debug.print('Clicked: Redeem');

      if (EasyPoints.Form.redeem({event: e})) {
        var checkoutBtn = EasyPoints.Selectors.getCheckoutButtonEl(document, true);

        e.target.style.cursor = 'progress';
        e.target.setAttribute('disabled', true);
        checkoutBtn.forEach((node) => node.setAttribute('disabled', true));

        EasyPoints.Form.setCoupon(
          function() {
            EasyPoints.applyDiscount();

            e.target.style.cursor = 'unset';
            e.target.removeAttribute('disabled');

            var checkoutBtn = EasyPoints.Selectors.getCheckoutButtonEl(document, true);
            checkoutBtn.forEach((node) => node.removeAttribute('disabled'));
          }
        )
      }
    },

    /**
     * Handler for the 'click' event on the Reset button.
     * It sets a loading cursor, disables the button, resets the form,
     * and then reverts the cursor and re-enables the button.
     *
     * @param {Event} e - The event object.
     */
    onClickResetBtn: function(e) {
      e.preventDefault();
      EasyPoints.Debug.print('Clicked: Reset');

      var checkoutBtn = EasyPoints.Selectors.getCheckoutButtonEl(document, true);
      e.target.style.cursor = 'progress';
      e.target.setAttribute('disabled', true);
      checkoutBtn.forEach((node) => node.setAttribute('disabled', true));

      EasyPoints.Form.setCoupon(
        function() {
          EasyPoints.reset({event: e});

          e.target.style.cursor = 'unset';
          e.target.removeAttribute('disabled');
          checkoutBtn.forEach((node) => node.removeAttribute('disabled'));
        }
      )
    }
  }
};
