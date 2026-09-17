document.addEventListener('DOMContentLoaded', () => {
  /* ---------- Header scroll state ---------- */
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 12);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile nav ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => mobileNav.classList.remove('open'));
    });
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: '0px 0px -10px 0px' });
    revealEls.forEach(el => io.observe(el));

    // Safety net: in case an element never intersects for any reason
    // (e.g. it is taller than the viewport and scrolled past quickly),
    // make sure it is still visible shortly after load.
    window.setTimeout(() => {
      revealEls.forEach(el => el.classList.add('in'));
    }, 2500);
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!question || !answer) return;
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(openItem => {
        if (openItem !== item) {
          openItem.classList.remove('open');
          openItem.querySelector('.faq-answer').style.maxHeight = null;
        }
      });
      item.classList.toggle('open', !isOpen);
      answer.style.maxHeight = !isOpen ? answer.scrollHeight + 'px' : null;
    });
  });

  /* ---------- Active nav link on scroll ---------- */
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.main-nav a, .mobile-nav a');
  if (sections.length && navLinks.length) {
    const setActive = () => {
      let currentId = '';
      sections.forEach(sec => {
        const rect = sec.getBoundingClientRect();
        if (rect.top <= 120 && rect.bottom >= 120) currentId = sec.id;
      });
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + currentId);
      });
    };
    window.addEventListener('scroll', setActive, { passive: true });
    setActive();
  }

  /* ---------- Demo carousel (home) ---------- */
  const track = document.querySelector('.demo-grid');
  const prevBtn = document.querySelector('[data-demo-prev]');
  const nextBtn = document.querySelector('[data-demo-next]');
  if (track && prevBtn && nextBtn) {
    const scrollAmount = () => track.clientWidth * 0.9;
    nextBtn.addEventListener('click', () => track.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));
    prevBtn.addEventListener('click', () => track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
  }

  /* ---------- Spotlight hover glow (cards) ---------- */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (!prefersReducedMotion && supportsHover) {
    document.querySelectorAll('.spotlight').forEach(card => {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        card.style.setProperty('--my', `${e.clientY - rect.top}px`);
      });
    });

    /* ---------- Subtle hero mockup tilt ---------- */
    const heroVisual = document.querySelector('.hero-visual');
    if (heroVisual) {
      let ticking = false;
      let targetX = 0, targetY = 0;
      heroVisual.addEventListener('pointermove', (e) => {
        const rect = heroVisual.getBoundingClientRect();
        targetX = (e.clientX - rect.left) / rect.width - 0.5;
        targetY = (e.clientY - rect.top) / rect.height - 0.5;
        if (!ticking) {
          window.requestAnimationFrame(() => {
            const rotY = targetX * 5;
            const rotX = targetY * -5;
            heroVisual.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
            ticking = false;
          });
          ticking = true;
        }
      });
      heroVisual.addEventListener('pointerleave', () => {
        heroVisual.style.transform = '';
      });
    }
  }
});
