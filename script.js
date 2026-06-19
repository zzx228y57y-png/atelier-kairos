// Atelier Kairos — interactions

// Menu mobile
const toggle = document.querySelector('.nav__toggle');
const links = document.querySelector('.nav__links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', links.classList.contains('open'));
  });
  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
}

// FAQ accordéon
document.querySelectorAll('.faq__q').forEach(q => {
  q.addEventListener('click', () => {
    const item = q.closest('.faq__item');
    const answer = item.querySelector('.faq__a');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq__item.open').forEach(o => {
      o.classList.remove('open');
      o.querySelector('.faq__a').style.maxHeight = null;
    });
    if (!isOpen) {
      item.classList.add('open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  });
});

// Animations d'apparition au scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Formulaire de contact (démo — à connecter à un service d'envoi d'email)
const form = document.querySelector('#contact-form');
if (form) {
  form.addEventListener('submit', (e) => {
    // Si l'attribut data-demo est présent, on simule l'envoi (placeholder)
    if (form.dataset.demo === 'true') {
      e.preventDefault();
      const note = document.querySelector('#form-status');
      if (note) {
        note.textContent = 'Merci, votre message a bien été pris en compte. (Démo — le formulaire sera connecté à une vraie adresse email avant la mise en ligne.)';
        note.style.color = 'var(--terracotta-fonce)';
      }
      form.reset();
    }
  });
}
