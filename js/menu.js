const music = document.getElementById('bg-music');
const musicToggle = document.getElementById('music-toggle');
const tabButtons = document.querySelectorAll('.tab-btn');
const menuItems = document.querySelectorAll('.menu-item');
const addButtons = document.querySelectorAll('.add-btn');
const cartList = document.getElementById('cart-items');
const subtotalSpan = document.getElementById('subtotal-price');
const totalPriceSpan = document.getElementById('total-price');
const checkoutBtn = document.getElementById('checkout-btn');
const modal = document.getElementById('modal');
const backHomeBtn = document.getElementById('back-home');

const mobileCartBar = document.getElementById('mobile-cart-bar');
const mobileCartText = document.getElementById('mobile-cart-text');
const mobileCartBtn = document.getElementById('mobile-cart-btn');

const gameDiscountText = document.getElementById('game-discount-text');

const imgModal = document.getElementById('image-modal');
const imgModalPic = document.getElementById('image-modal-pic');
const imgModalTitle = document.getElementById('image-modal-title');
const imgModalClose = document.getElementById('image-modal-close');

let isMusicPlaying = false;

let cart = [];
try {
  cart = JSON.parse(localStorage.getItem('cartData')) || [];
} catch (e) {
  cart = [];
}

if (music && musicToggle) {
  musicToggle.addEventListener('click', () => {
    if (!isMusicPlaying) {
      music.play();
      isMusicPlaying = true;
      musicToggle.textContent = '♫ Pause';
    } else {
      music.pause();
      isMusicPlaying = false;
      musicToggle.textContent = '♫ Music';
    }
  });
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const category = btn.dataset.category;

    menuItems.forEach(item => {
      if (category === 'all' || item.dataset.category === category) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  });
});

addButtons.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    const item = menuItems[index];
    const name = item.querySelector('h3').textContent;
    const price = Number(item.dataset.price);

    const exist = cart.find(c => c.name === name);
    if (exist) {
      exist.qty++;
    } else {
      cart.push({ name, price, qty: 1 });
    }
    renderCart();
  });
});

function renderCart() {
  cartList.innerHTML = '';
  let subtotal = 0;
  let totalItems = 0;

  cart.forEach((item, i) => {
    subtotal += item.price * item.qty;
    totalItems += item.qty;

    const li = document.createElement('li');
    li.className = 'cart-item';

    const info = document.createElement('span');
    info.textContent = `${item.name} x ${item.qty}`;

    const controls = document.createElement('span');
    controls.className = 'cart-controls';

    const minusBtn = document.createElement('button');
    minusBtn.textContent = '-';
    minusBtn.addEventListener('click', () => {
      item.qty--;
      if (item.qty <= 0) cart.splice(i, 1);
      renderCart();
    });

    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      item.qty++;
      renderCart();
    });

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'x';
    removeBtn.addEventListener('click', () => {
      cart.splice(i, 1);
      renderCart();
    });

    controls.append(minusBtn, plusBtn, removeBtn);
    li.append(info, controls);
    cartList.appendChild(li);
  });

  let discount = 0;

  let fullDiscount = 0;
  if (subtotal >= 300) {
    fullDiscount = 30;
    discount += fullDiscount;
  }

  let gameDiscount = Number(localStorage.getItem('gameDiscount') || 0);
  if (gameDiscount > 100) gameDiscount = 100;
  if (gameDiscount > subtotal - fullDiscount) {
    gameDiscount = Math.max(subtotal - fullDiscount, 0);
  }
  discount += gameDiscount;

  subtotalSpan.textContent = subtotal;
  const finalTotal = Math.max(subtotal - discount, 0);
  totalPriceSpan.textContent = finalTotal;

  if (subtotal === 0) {
    gameDiscountText.textContent = '目前尚未選購商品。';
  } else {
    gameDiscountText.textContent =
      `滿額折扣：${fullDiscount} 元；小遊戲折扣：${gameDiscount} 元`;
  }

  if (totalItems > 0) {
    mobileCartBar.classList.remove('hidden');
    mobileCartText.textContent = `${totalItems} 項商品 | NT$ ${finalTotal}`;
  } else {
    mobileCartBar.classList.add('hidden');
    mobileCartText.textContent = `0 項商品 | NT$ 0`;
  }

  localStorage.setItem('cartData', JSON.stringify(cart));
}

if (mobileCartBtn) {
  mobileCartBtn.addEventListener('click', () => {
    const cartSection = document.getElementById('cart');
    cartSection.scrollIntoView({ behavior: 'smooth' });
  });
}

checkoutBtn.addEventListener('click', () => {
  if (cart.length === 0) {
    alert('購物車是空的喔～');
    return;
  }
  modal.classList.remove('hidden');
});

backHomeBtn.addEventListener('click', () => {
  modal.classList.add('hidden');

  cart = [];
  localStorage.setItem('cartData', JSON.stringify(cart));

  localStorage.removeItem('gameDiscount');

  localStorage.removeItem('gamePlayCount');

  renderCart();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

const snowLayer = document.querySelector('.snow-layer');
if (snowLayer) {
  for (let i = 0; i < 40; i++) {
    const span = document.createElement('span');
    span.className = 'snowflake';
    span.textContent = '❄';
    span.style.left = Math.random() * 100 + 'vw';
    span.style.animationDuration = 5 + Math.random() * 7 + 's';
    span.style.animationDelay = Math.random() * 5 + 's';
    snowLayer.appendChild(span);
  }
}

const menuImages = document.querySelectorAll('.menu-item img');
menuImages.forEach(img => {
  img.style.cursor = 'zoom-in';
  img.addEventListener('click', () => {
    if (!imgModal) return;
    imgModalPic.src = img.src;
    const titleEl = img.closest('.menu-item').querySelector('h3');
    imgModalTitle.textContent = titleEl ? titleEl.textContent : '';
    imgModal.classList.remove('hidden');
  });
});

if (imgModalClose) {
  imgModalClose.addEventListener('click', () => {
    imgModal.classList.add('hidden');
  });
}
if (imgModal) {
  imgModal.addEventListener('click', e => {
    if (e.target === imgModal) imgModal.classList.add('hidden');
  });
}

renderCart();
