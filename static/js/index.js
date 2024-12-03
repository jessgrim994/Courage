document.addEventListener('DOMContentLoaded', function() {
    // Initialize AOS with more subtle settings
    AOS.init({
        duration: 1200,
        once: true,
        offset: 100,
        easing: 'ease'
    });

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll <= 0) {
            navbar.style.opacity = '1';
            return;
        }
        
        if (currentScroll > lastScroll) {
            navbar.style.opacity = '0.9';
        } else {
            navbar.style.opacity = '1';
        }
        lastScroll = currentScroll;
    });

    // Subtle fade-in effect for subtitle
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
        const text = subtitle.textContent;
        subtitle.textContent = '';
        let i = 0;
        
        const typeWriter = () => {
            if (i < text.length) {
                subtitle.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 70);
            }
        };
        setTimeout(typeWriter, 1000);
    }

    // Elegant particle effect
    const createParticles = () => {
        const particlesContainer = document.createElement('div');
        particlesContainer.className = 'particles';
        document.body.appendChild(particlesContainer);

        for (let i = 0; i < 30; i++) {
            createParticle(particlesContainer);
        }
    };

    function createParticle(container) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.width = `${Math.random() * 2 + 1}px`;
        particle.style.height = particle.style.width;
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.opacity = Math.random() * 0.2;
        particle.style.animation = `float ${Math.random() * 4 + 3}s linear infinite`;
        container.appendChild(particle);

        particle.addEventListener('animationend', () => {
            particle.remove();
            createParticle(container);
        });
    }

    createParticles();

    // Subtle hover effects for feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            const icon = card.querySelector('i');
            if (icon) {
                icon.style.transform = 'scale(1.1)';
            }
        });
        
        card.addEventListener('mouseleave', () => {
            const icon = card.querySelector('i');
            if (icon) {
                icon.style.transform = 'scale(1)';
            }
        });
    });
});

// Add subtle animations
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-15px); }
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;
document.head.appendChild(style); 