window.addEventListener('DOMContentLoaded', function() {
  var path = this.window.location.pathname;
  var re = /\/cart/i;


  if (!path.match(re)) {
    return;
  }

  EasyPoints.Register.run();
  EasyPoints.removeDiscount();
});

var EasyPoints = {

  Debug: {
    DEBUG: false,

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
     * @param {Document | HTMLElement} element - The root element to start the search from.
     * @param {string} selector - A DOMString containing one or more selectors to match.
     * @param {boolean} [nodes=false] - If true, the method will return all matching elements, otherwise it will return the first matching element.
     * @returns {HTMLElement | NodeList | null} - Returns the first matching element if `nodes` is false, a NodeList of matching elements if `nodes` is true, or null if no match is found.
     */
    getElementBy$: function(element, selector, nodes = false) {
      var element =
        nodes ? element.querySelectorAll(selector) : element.querySelector(selector);

      if (!element) {
        EasyPoints.Debug.print('Could not locate ' + selector, 'warn');
      }

      return element;
    },

    /**
     * @param {Document | HTMLElement} element - The root element to start the search from.
     * @param {boolean} [nodes=false] - If true, the method will return all matching elements with attribute data-loyal-target equals to "total-points-value", otherwise it will return the first matching element.
     * @returns {HTMLElement | NodeList | null} - Returns the first matching element if `nodes` is false, a NodeList of matching elements if `nodes` is true, or null if no match is found.
     */
    getTotalPointsEl: function(element, nodes = false) {
      return this.getElementBy$(element, '[data-loyal-target="total-points-value"]', nodes);
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
    },
  },

  Points: {
    /**
     * Retrieves the total costs that are excluded from loyalty points calculation.
     *
     * @returns {number} - The total excluded cost.
     */
    getExcludedCost() {
      var excluded =
        Array.from(document.querySelectorAll('[data-loyal-target="point-exclusion"]'))
          .reduce((acc, node) => acc + parseInt(node.dataset.loyalCurrencyCost), 0);

      return excluded;
    },

    /**
     * Retrieves the total bonus points available in the document or the given element.
     *
     * @param {Document | HTMLElement} [el=document] - The root element to start the search from.
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
     * @param {Document | HTMLElement} containerEl - The container within which to search for elements.
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
          } else {
            total -= EasyPoints.Points.getExcludedCost();
          }

          EasyPoints.Points.setCurrencyCost(node, { price: Math.floor(total), ignoreTax: ignoreTax });
          window.easyPointsSDK.insertPointValue(node);

          var totalPoints = parseInt(node.innerText.replace(/\D/g, ''));

          // hack: some themes innerText returns empty string
          if (isNaN(totalPoints)) {
            totalPoints = parseInt(node.textContent.replace(/\D/g, ''));
          }

          totalPoints += Math.round(EasyPoints.Points.getTotalBonusPoints(containerEl));
          window.easyPointsSDK.insertPointValueIntoElement(node, totalPoints);
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
    getPriceFromEl: function(element, selector = null, regex = /[^\d]/g) {
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
    getTaxedCost: function({ price, tax }, el = null) {
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
    setCost(node, attribute, { price = null, multiplier = 1, ignoreTax = false }) {
      price = (price !== null ? price : parseInt(node.dataset.loyalCurrencyCost)) * multiplier;

      if (price <= 0) {
        node.setAttribute(attribute, 0);
        return;
      }

      if (node.dataset.loyalOpts) {
        var opts = JSON.parse(node.dataset.loyalOpts);

        if (!ignoreTax) {
          price = this.getTaxedCost({ price: price, tax: opts.tax });
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
        window.easyPointsSDK.updateLoyaltyTargets();
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
        if (req.readyState === XMLHttpRequest.DONE) {
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
            var exists = Array.prototype.find.call(inputs, function(el) {
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

      var discount = window.easyPointsSDK.getDiscountSession();
      var subtotal = priceEl.dataset.loyalTotalPrice;

      var { multiplier } = window.easyPointsSDK.Currency.getFormatOptions() || { multiplier: 100 };
      var discountNoDecimal = Math.round(discount * window.easyPointsSDK.Currency.getRate() * multiplier)
      var cost = subtotal - discountNoDecimal;

      if (cost >= 0) {
        priceEl.innerHTML = window.easyPointsSDK.Currency.format(cost);

        var totalPointsEl = el.querySelector('.points-after-applied-discount');
        if (totalPointsEl) {
          var totalPoints = parseInt(totalPointsEl.innerText.replace(/\D/g, ''));
          var subtotalTaxed = EasyPoints.Points.getTaxedCost({ price: subtotal, tax: null }, totalPointsEl);
          var costTaxed = EasyPoints.Points.getTaxedCost({ price: cost, tax: null }, totalPointsEl);

          window.easyPointsSDK.insertPointValueIntoElement(
            totalPointsEl,
            window.easyPointsSDK.formatBigNumber(
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

          var discount = window.easyPointsSDK.getDiscountSession();

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

  /**
   * Applies the discount from session storage if it's greater than 0. Updates the UI accordingly.
   */
  loadDiscount: function() {
    var discount = window.easyPointsSDK.getDiscountSession()

    EasyPoints.Debug.print('Applying discount: ' + discount);

    if (discount > 0) {
      window.easyPointsSDK.displayDiscount(discount);

      EasyPoints.UI.showDiscount();
      EasyPoints.UI.cloneSubtotal();
      EasyPoints.Selectors.getAdditionalCheckoutButtonEl(document, true)
        .forEach(node => node.classList.add('easy-points-hide'));
    }
  },

  /**
   * Removes the applied discount if it's greater than 0. Disables the checkout and reset buttons during the process.
   */
  removeDiscount: function() {
    if (window.easyPointsSDK.getDiscountSession() > 0) {
      EasyPoints.Debug.print('Removing discount');
      var checkoutBtn = EasyPoints.Selectors.getCheckoutButtonEl(document, true);
      var resetBtn = EasyPoints.Selectors.getResetPointsButtonEl(document);

      resetBtn.setAttribute('disabled', true);
      checkoutBtn.forEach((node) => node.setAttribute('disabled', true));

      window.easyPointsSDK.removeDiscount()
      EasyPoints.reset({});

      resetBtn.removeAttribute('disabled');
      checkoutBtn.forEach((node) => node.removeAttribute('disabled'));
    }
  },

  /**
   * Resets the applied discount, updates the UI, and clears the discount from the session storage.
   * @param {Object} options The options for the reset.
   * @param {Event} [options.event=null] The event that triggered the reset, if applicable.
   */
  reset: function({ event = null }) {
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
     * Redeems the given points or the points value from the event's related form.
     *
     * @param {Object} options The options for the redemption.
     * @param {Event} [options.event=null] The event that triggered the redemption, if applicable.
     * @param {number} [options.points=null] The points to redeem, if provided.
     * @returns {boolean} Whether the redemption was successful.
     */
    redeem({ event = null, points = null }) {
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

      const result = window.easyPointsSDK.setRedemptionPoints({ points: points });
      return result;
    },
  },

  Register: {
    /**
     * Run the registration process by updating the loyalty targets,
     * inserting the total points, recalculating tiers, setting up event listeners,
     * and applying any discount.
     */
    run: function() {
      window.easyPointsSDK.updateLoyaltyTargets();
      window.easyPointsSDK.setup();
      EasyPoints.Points.insertTotalPoints(document);
      EasyPoints.Tiers.recalculate()

      this.setEventListeners();
      EasyPoints.loadDiscount();
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
            window.easyPointsSDK.setRedemptionPoints({ points: node.value })
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
    onClickRedeemBtn: async function(e) {
      e.preventDefault();
      EasyPoints.Debug.print('Clicked: Redeem');

      if (EasyPoints.Form.redeem({ event: e })) {
        var checkoutBtn = EasyPoints.Selectors.getCheckoutButtonEl(document, true);

        e.target.style.cursor = 'progress';
        e.target.setAttribute('disabled', true);
        checkoutBtn.forEach((node) => node.setAttribute('disabled', true));

        const discount = window.easyPointsSDK.getDiscountSession();
        await window.easyPointsSDK.applyDiscount(discount);

        e.target.style.cursor = 'unset';
        e.target.removeAttribute('disabled');

        var checkoutBtn = EasyPoints.Selectors.getCheckoutButtonEl(document, true);
        checkoutBtn.forEach((node) => node.removeAttribute('disabled'));
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
      window.easyPointsSDK.removeDiscount()
      e.target.style.cursor = 'unset';
      e.target.removeAttribute('disabled');
      checkoutBtn.forEach((node) => node.removeAttribute('disabled'));
    }
  }
};
