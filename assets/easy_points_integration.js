/**
 * v1.92
 *
 * Required functions from `easy_points.js`
 *  - updateLoyaltyTargets/0
 *  - updateDisplayedDiscount/0
 *  - displayDiscount/1
 *  - formatBigNumber/1
 *  - insertPointValue/1
 */

const EasyPoints = {

  Debug: {
    DEBUG: true,

    print: (msg, type = 'info') => {
      if (!this.DEBUG) {
        return;
      }

      const epMsg = `[EasyPoints] ${msg}`;

      switch (type.toLowerCase()) {
        case 'warn':
          console.warn(epMsg);
          break;
        case 'error':
          console.error(epMsg);
          break;
        default:
          console.info(epMsg);
          break;
      }
    },
  },

  Selectors: {
    getElementBy$: (parent, selector, nodes = false) => {
      const element = nodes ? parent.querySelectorAll(selector) : parent.querySelector(selector);

      if (!element) {
        EasyPoints.Debug.print(`Could not locate ${selector}`, 'warn');
      }

      return element;
    },

    getTotalPointsEl: (el, nodes = false) => {
      return this.getElementBy$(el, '[data-loyal-target="total-points-value"]', nodes);
    },

    getRedeemContainerEl: (element, nodes = false) => {
      return this.getElementBy$(element, '.easy-points-form__container', nodes);
    },

    getRedeemPointsButtonEl: (element, nodes = false) => {
      return this.getElementBy$(element, '.easy-points-button__redeem', nodes);
    },

    getResetPointsButtonEl: (element, nodes = false) => {
      return this.getElementBy$(element, '.easy-points-button__reset', nodes);
    },

    getRedeemPointsInputEl: (element, nodes = false) => {
      return this.getElementBy$(element, '.easy-points-form__input input', nodes);
    },

    getCheckoutButtonEl: (element, nodes = false) => {
      return this.getElementBy$(element, '[type="submit"][name="checkout"]', nodes);
    },

    getAdditionalCheckoutButtonEl: (element, nodes = false) => {
      return this.getElementBy$(element, '.additional-checkout-buttons', nodes);
    },
  },

  Points: {
    getExcludedCost() {
      const excluded = Array.from(document.querySelectorAll('[data-loyal-target="point-exclusion"]'))
        .reduce((acc, node) => acc + parseInt(node.dataset.loyalCurrencyCost), 0);

      return excluded;
    },

    getTotalBonusPoints(el = document) {
      const total = Array.from(el.querySelectorAll('[data-loyal-bonus-points]'))
        .reduce((acc, node) => {
          let { bonusPoints } = JSON.parse(node.dataset.loyalBonusPoints);
          bonusPoints = parseInt(bonusPoints);

          if (!Number.isNaN(bonusPoints) && bonusPoints > 0) {
            return acc + bonusPoints;
          }

          return acc;
        }, 0);

      return total;
    },

    insertTotalPoints(containerEl) {
      EasyPoints.Selectors.getTotalPointsEl(containerEl, true)
        .forEach((node) => {
          let ignoreTax = false;
          const { tax } = JSON.parse(node.dataset.loyalOpts);
          let total = parseInt(node.dataset.loyalCurrencyCost);

          if (!tax.awardable || !tax.included) {
            const pointEls = [...document.querySelectorAll('[data-loyal-target="point-value"]')];

            // calculate the total price from all cart item point values
            // must use the `item.final_price` otherwise qty must be ignored
            // {% render 'points', item: item, price: item.final_price %}

            // ignore tax because we calculate total cost from all point values on the page
            ignoreTax = true;

            total = pointEls.reduce((acc, pointEl) => {
              const { loyalCurrencyCost: cost, loyalQuantity: qty } = pointEl.dataset;
              return (cost * qty) + acc;
            }, 0);
          }

          total -= EasyPoints.Points.getExcludedCost();

          EasyPoints.Points.setCurrencyCost(node, { price: Math.floor(total), ignoreTax: ignoreTax });
          window.insertPointValue(node);

          let totalPoints = parseInt(node.innerText.replace(/\D/g, ''));

          // hack: some themes innerText returns empty string
          if (Number.isNaN(totalPoints)) {
            totalPoints = parseInt(node.textContent.replace(/\D/g, ''));
          }

          totalPoints += Math.round(window.EasyPoints.Points.getTotalBonusPoints(containerEl));
          window.insertPointValueIntoElement(node, totalPoints);
        });
    },

    getPriceFromEl: (element, selector = null, regex = /[^\d]/g) => {
      const el = selector ? element.querySelector(selector) : element;

      if (el) {
        return parseInt(el.textContent.replace(regex, '')) * 100;
      }

      return null;
    },

    getTaxedCost: ({ price, tax }, el = null) => {
      let baseTax = tax;
      if (el !== null && el.dataset.loyalOpts) {
        const opts = JSON.parse(el.dataset.loyalOpts);
        baseTax = opts.tax;
      }

      if (baseTax === null) {
        EasyPoints.Debug.print('Tax object not defined.', 'error');
        return price;
      }

      if (baseTax.included) {
        return price;
      }

      return baseTax.exempt ? price : Math.floor(price * baseTax.rate);
    },

    setCost(node, attribute, { price = null, multiplier = 1, ignoreTax = false }) {
      let calculatedPrice = (price !== null ? price : parseInt(node.dataset.loyalCurrencyCost)) * multiplier;

      if (calculatedPrice <= 0) {
        node.setAttribute(attribute, 0);
        return;
      }

      if (node.dataset.loyalOpts) {
        const opts = JSON.parse(node.dataset.loyalOpts);

        if (!ignoreTax) {
          calculatedPrice = this.getTaxedCost({ price: calculatedPrice, tax: opts.tax });
        }
      }

      node.setAttribute(attribute, calculatedPrice);
    },

    setCurrencyCost(node, opts) {
      this.setCost(node, 'data-loyal-currency-cost', opts);
    },

    /**
     * Resets all `[data-loyal-target="point-value"]` targets to their original values.
     * Original values are calculated through options on the element.
     */
    resetTargets: (priceOptions = {}, callback = null, container = null) => {
      const selector = container != null
        ? `${container} [data-loyal-target="point-value"]`
        : '[data-loyal-target="point-value"]';

      document
        .querySelectorAll(selector)
        .forEach((node) => {
          // ignore total points
          if (node.classList.contains('points-after-applied-discount')) {
            return;
          }

          this.setCurrencyCost(node, priceOptions);
        });

      if (callback) {
        callback();
      } else {
        window.updateLoyaltyTargets();
      }
    },
  },

  Cart: {
    url: () => {
      return `${window.location.origin}/cart.json`;
    },

    getFromJSON: (callback) => {
      const req = new window.XMLHttpRequest();

      req.onreadystatechange = () => {
        if (req.readyState === window.XMLHttpRequest.DONE) {
          const { status } = req;

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

    setRedemptionForm: () => {
      this.getFromJSON((cart) => {
        const form = document.getElementById('point-redemption-form');

        if (form) {
          const maxRedeemableInputEl = form.querySelector('input[name="coupon[max_redeemable]"]');
          if (maxRedeemableInputEl) {
            maxRedeemableInputEl.value = cart.total_price;
          }

          cart.items.forEach((item) => {
            const inputs = form.querySelectorAll('input[name="coupon[product_ids][]"]');
            const exists = Array.prototype.find.call(inputs, (el) => {
              return String(el.value) === String(item.product_id);
            });

            if (!exists) {
              const input = document.createElement('input');
              input.setAttribute('type', 'hidden');
              input.setAttribute('name', 'coupon[product_ids][]');
              input.setAttribute('value', item.product_id);
              form.appendChild(input);

              EasyPoints.Debug.print('New cart item input created for the submission form.');
            }
          });
        }
      });
    },
  },

  Referrals: {
    setup() {
      const ref = 'easy-points-ref';
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get(ref);

      if (refCode === window.EasyPointsData.customer?.id?.toString()) {
        // Don't refer self
        return;
      }

      if (refCode && !window.localStorage.getItem(ref)) {
        window.localStorage.setItem(ref, refCode);
      }

      const storedRef = window.localStorage.getItem(ref);
      const signUpFormEl = EasyPoints.Selectors.getElementBy$(document, 'form[action="/account"]');

      if (signUpFormEl && storedRef) {
        const customerCreateEl = EasyPoints.Selectors.getElementBy$(
          signUpFormEl,
          'input[name="form_type"][value="create_customer"]'
        );

        if (customerCreateEl) {
          signUpFormEl.appendChild(
            EasyPoints.Referrals.createReferralInput('customer[note][easypoints-referrer]', storedRef)
          );
        }
      }

      const productFormEls = EasyPoints.Selectors.getElementBy$(
        document,
        'form[action="/cart/add"]',
        true
      );

      if (productFormEls.length > 0) {
        const productId = productFormEls[0].querySelector('input[name="id"]').value;
        const storageKey = `${ref}-products`;
        const referredProducts = JSON.parse(window.localStorage.getItem(storageKey) || '{}');

        if (urlParams.has(ref)) {
          referredProducts[productId] = refCode;
          window.localStorage.setItem(storageKey, JSON.stringify(referredProducts));
        }

        const productRefCode = referredProducts[productId];

        if (productRefCode) {
          productFormEls.forEach((form) => {
            form.appendChild(window.EasyPoints.Referrals.createReferralInput(
              'properties[_easypoints-referrer]',
              productRefCode
            ));
          });
        }
      }

      document.querySelector('#easy-points__referral-copy')
        ?.addEventListener('click', EasyPoints.Referrals.copyToClipboard);

      document.querySelector('.easy-points__referral-social-share')
        ?.addEventListener('click', EasyPoints.Referrals.openMediaShare);

      document.querySelector('.easy-points__referral-share')
        ?.addEventListener('click', EasyPoints.Referrals.openModal);

      document.querySelector('.easy-points__referral-close-button')
        ?.addEventListener('click', EasyPoints.Referrals.closeModal);

      document.querySelector('.easy-points__referral-modal')
        ?.addEventListener('click', (ev) => {
          if (ev.target === document.querySelector('.easy-points__referral-modal')) {
            EasyPoints.Referrals.closeModal();
          }
        });
    },

    createReferralInput(name, value) {
      const refInputEl = document.createElement('input');
      refInputEl.type = 'hidden';
      refInputEl.value = value;
      refInputEl.name = name;
      return refInputEl;
    },

    copyToClipboard() {
      const referral = document.querySelector('#easy-points__referral');
      const referralInputEl = referral.querySelector('input');

      if (referral.hasAttribute('copying') || referral.hasAttribute('copied')) {
        return;
      }

      referral.setAttribute('copying', true);

      setTimeout(() => {
        referral.setAttribute('copied', true);
        referral.removeAttribute('copying');
      }, 350);

      setTimeout(() => {
        referral.removeAttribute('copied');
      }, 1500);

      window.navigator.clipboard.writeText(referralInputEl.value);
    },

    openMediaShare(ev) {
      const url = document.querySelector('#easy-points-ref-url').value;
      const { base } = ev.target.dataset;
      const shareUrl = base.replace('{url}', encodeURIComponent(url));

      window.open(shareUrl, '_blank');
    },

    closeModal() {
      document.querySelector('.easy-points__referral-modal').dataset.open = false;
    },

    openModal() {
      const url = document.querySelector('#easy-points-ref-url').value;

      if (window.navigator.share) {
        window.navigator.share({ url });
      } else {
        document.querySelector('.easy-points__referral-modal').dataset.open = true;
      }
    },
  },

  UI: {
    showHidden: () => {
      EasyPoints.Selectors.getElementBy$(document, '.hidden-unless-discount-applied', true)
        .forEach((node) => node.classList.remove('easy-points-hide'));
    },

    hideHidden: () => {
      EasyPoints.Selectors.getElementBy$(document, '.hidden-unless-discount-applied', true)
        .forEach((node) => node.classList.add('easy-points-hide'));
    },

    cloneSubtotal: () => {
      EasyPoints.Selectors.getElementBy$(document, '[data-loyal-target="subtotal"]', true)
        .forEach((node) => {
          const clone = node.cloneNode(true);
          clone.removeAttribute('data-loyal-target');
          clone.setAttribute('data-loyal-clone', 'subtotal');

          node.classList.add('easy-points-hide');
          node.insertAdjacentElement('beforebegin', this.modifySubtotal(clone));
        });
    },

    resetClonedSubtotal: () => {
      EasyPoints.Selectors.getElementBy$(document, '[data-loyal-clone]', true)
        .forEach((node) => node.remove());

      EasyPoints.Selectors.getElementBy$(document, '[data-loyal-target="subtotal"]', true)
        .forEach((node) => node.classList.remove('easy-points-hide'));
    },

    modifySubtotal: (el) => {
      const priceEl = el.querySelector('[data-loyal-target="total_price"]');

      if (!priceEl) {
        EasyPoints.Debug.print('modifySubtotal(el): missing total price target.');
        return el;
      }

      const discount = EasyPoints.getDiscountSession();
      const subtotal = priceEl.dataset.loyalTotalPrice;

      const { multiplier } = window.EasyPointsCore.Currency.getFormatOptions() || { multiplier: 100 };
      const discountNoDecimal = Math.round(discount * window.EasyPointsCore.Currency.getRate() * multiplier);
      const cost = subtotal - discountNoDecimal;

      if (cost >= 0) {
        priceEl.innerHTML = window.EasyPointsCore.Currency.format(cost);

        const totalPointsEl = el.querySelector('.points-after-applied-discount');
        if (totalPointsEl) {
          const totalPoints = parseInt(totalPointsEl.innerText.replace(/\D/g, ''));
          const subtotalTaxed = EasyPoints.Points.getTaxedCost({ price: subtotal, tax: null }, totalPointsEl);
          const costTaxed = EasyPoints.Points.getTaxedCost({ price: cost, tax: null }, totalPointsEl);

          window.insertPointValueIntoElement(
            totalPointsEl,
            window.formatBigNumber(
              Math.max(0, Math.ceil((costTaxed / subtotalTaxed) * totalPoints))
            )
          );
        }
      }

      return el;
    },

    showDiscount: () => {
      this.showHidden();
      this.buttonReset();
    },

    hideDiscount: () => {
      this.hideHidden();
      this.buttonRedeem();
    },

    buttonRedeem: () => {
      EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
        .forEach((node) => node.removeAttribute('disabled'));

      EasyPoints.Selectors.getResetPointsButtonEl(document, true)
        .forEach((node) => node.classList.add('easy-points-hide'));

      EasyPoints.Selectors.getRedeemPointsButtonEl(document, true)
        .forEach((node) => node.classList.remove('easy-points-hide'));
    },

    buttonReset: () => {
      EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
        .forEach((pointsInput) => {
          pointsInput.setAttribute('disabled', true);

          const discount = EasyPoints.getDiscountSession();

          if (
            !pointsInput.classList.contains('valid')
            && (pointsInput.value === '' || pointsInput.value <= 0) && discount > 0) {
            pointsInput.value = discount;
          }
        });

      EasyPoints.Selectors.getResetPointsButtonEl(document, true)
        .forEach((node) => node.classList.remove('easy-points-hide'));

      EasyPoints.Selectors.getRedeemPointsButtonEl(document, true)
        .forEach((node) => node.classList.add('easy-points-hide'));
    },
  },

  Tiers: {
    recalculate: (subtotal = null) => {
      const { rankAdvancementData } = window.getEasyPointsSession();

      if (!rankAdvancementData || rankAdvancementData.raw_amount >= 0) {
        return;
      }

      const discount = EasyPoints.getDiscountSession();
      const { multiplier } = window.EasyPointsCore.Currency.getFormatOptions() || { multiplier: 100 };
      const discountNoDecimal = Math.round(discount * window.EasyPointsCore.Currency.getRate() * multiplier);

      if (subtotal === null) {
        const priceEl = document.querySelector('[data-loyal-target="total_price"]');

        if (!priceEl) {
          EasyPoints.Debug.print('recalculate(el): missing total price target.', 'error');
          return;
        }

        subtotal = priceEl.dataset.loyalTotalPrice;
      }

      try {
        const nextTier = window.EasyPointsCore.Tiers.getNextTier(subtotal - discountNoDecimal);

        if (nextTier) {
          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="rank-advancement-tier-name"]')
          ).forEach((target) => {
            target.textContent = nextTier.name;
          });

          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="rank-advancement-amount"]')
          ).forEach((target) => {
            target.innerHTML = window.EasyPointsCore.Currency.format(nextTier.advancementAmountMultiplied);
          });
        } else {
          Array.prototype.slice.call(
            document.querySelectorAll('[data-loyal-target="rank-advancement-data"] > span')
          ).forEach((target) => {
            target.style.display = target.dataset.loyalTarget === 'max-rank'
              ? ''
              : 'none';
          });
        }
      } catch {
        EasyPoints.Debug.print('EasyPoints Tiers: error getting next tier.', 'error');
      }
    },
  },

  getDiscountSession: () => {
    const discount = window.sessionStorage.getItem('appliedDiscount');

    return discount ? parseInt(discount) : 0;
  },

  applyDiscount: () => {
    const discount = this.getDiscountSession();

    EasyPoints.Debug.print(`Applying discount: ${discount}`);

    if (discount > 0) {
      window.displayDiscount(discount);

      EasyPoints.UI.showDiscount();
      EasyPoints.UI.cloneSubtotal();
      EasyPoints.Selectors.getAdditionalCheckoutButtonEl(document, true)
        .forEach((node) => node.classList.add('easy-points-hide'));
    }
  },

  reset: () => {
    EasyPoints.UI.hideDiscount();
    EasyPoints.UI.resetClonedSubtotal();
    EasyPoints.Selectors.getAdditionalCheckoutButtonEl(document, true)
      .forEach((node) => node.classList.remove('easy-points-hide'));

    window.sessionStorage.removeItem('appliedDiscount');

    EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
      .forEach((node) => node.value = '');
  },

  Form: {
    update({ points }) {
      const input = EasyPoints.Selectors.getElementBy$(document, '#redemption-point-value');

      if (!input) {
        window.sessionStorage.removeItem('appliedDiscount');
        return false;
      }

      input.value = points;

      if (!window.EasyPointsCore.Validate.pointRedemption()) {
        window.sessionStorage.removeItem('appliedDiscount');

        EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
          .forEach((node) => node.classList.add('invalid'));

        return false;
      } else {
        window.sessionStorage.setItem('appliedDiscount', points);

        EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
          .forEach((node) => node.classList.remove('invalid'));

        return true;
      }
    },

    redeem({ event = null, points = null }) {
      if (points == null) {
        if (event == null) {
          EasyPoints.Debug.print('redeem({event, points}): cant get the points value', 'error');
          return false;
        }

        const form = event.target.closest('.easy-points-form__container');

        if (!form) {
          EasyPoints.Debug.print('redeem({event, points}): target form is not defined');
          return false;
        }

        if (input = window.EasyPoints.Selectors.getRedeemPointsInputEl(form)) {
          input.value = input.value.toString().replace(/[^\d]/g, '');
          points = input.value;
        }
      }

      return this.update({ points: points });
    },

    setCoupon(callback = null, reset = null) {
      if ((reset != null && !reset) || EasyPoints.getDiscountSession() > 0) {
        EasyPoints.Debug.print('Using /redeem');
        form = window.buildForm('/apps/loyalty/redeem');
      } else {
        EasyPoints.Debug.print('Using /reset');
        form = window.buildForm('/apps/loyalty/reset');
      }

      if (form) {
        const xhr = new window.XMLHttpRequest();

        xhr.onreadystatechange = (event) => {
          if (event.readyState === 4) {
            EasyPoints.Debug.print('Submitted');

            if (callback) {
              callback();
            }
          }
        };

        xhr.open('POST', form.action);
        const formData = new FormData(form);
        xhr.send(formData);

        EasyPoints.Debug.print('Submitting form');
      } else if (callback) {
        callback();
      }
    },
  },

  Register: {
    submissionReady: false,

    run: () => {
      window.updateLoyaltyTargets();
      EasyPoints.Points.insertTotalPoints(document);
      EasyPoints.Tiers.recalculate();

      this.setEventListeners();
      EasyPoints.applyDiscount();
    },

    setEventListeners: () => {
      if (EasyPoints.Selectors.getRedeemContainerEl(document, true).length === 0) {
        return;
      }

      EasyPoints.Selectors.getRedeemPointsInputEl(document, true)
        .forEach((node) => {
          node.addEventListener('focus', this.onPointsInput);

          if (node.value > 0) {
            EasyPoints.Form.update({ points: EasyPoints.getDiscountSession() });
          }
        });

      EasyPoints.Selectors.getRedeemPointsButtonEl(document, true)
        .forEach((node) => node.addEventListener('click', this.onClickRedeemBtn));

      EasyPoints.Selectors.getResetPointsButtonEl(document, true)
        .forEach((node) => node.addEventListener('click', this.onClickResetBtn));

      EasyPoints.Selectors.getCheckoutButtonEl(document, true)
        .forEach((node) => node.addEventListener('click', this.onClickSetCoupon));

      EasyPoints.Debug.print('Applied all required event listeners');
    },

    onPointsInput: (e) => {
      e.target.classList.remove('invalid');
    },

    onClickRedeemBtn: (e) => {
      e.preventDefault();
      EasyPoints.Debug.print('Clicked: Redeem');

      EasyPoints.Register.submissionReady = false;
      if (EasyPoints.Form.redeem({ event: e })) {
        EasyPoints.applyDiscount();
      }
    },

    onClickResetBtn: (e) => {
      e.preventDefault();
      EasyPoints.Debug.print('Clicked: Reset');

      EasyPoints.Register.submissionReady = false;
      EasyPoints.reset({ event: e });
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

      const checkoutBtn = e.target;
      checkoutBtn.style.cursor = 'progress';
      checkoutBtn.classList.add('btn--loading');
      checkoutBtn.setAttribute('disabled', true);

      EasyPoints.Form.setCoupon(
        () => {
          EasyPoints.Register.submissionReady = true;

          checkoutBtn.style.cursor = 'unset';
          checkoutBtn.classList.remove('btn--loading');
          checkoutBtn.removeAttribute('disabled');
          checkoutBtn.click();

          if (callback) {
            callback();
          }
        }
      );
    },
  },
};

window.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  const re = /\/cart/i;

  EasyPoints.Referrals.setup();

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
