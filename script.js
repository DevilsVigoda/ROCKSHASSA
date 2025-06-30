document.addEventListener('DOMContentLoaded', function() {
    // Matrix effect
    const matrix = document.getElementById('matrix');
    const width = window.innerWidth;
    const height = window.innerHeight;
    const fontSize = 14;
    const columns = Math.floor(width / fontSize);
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&()*+-/<=>?@[\\]^_{|}~";
    
    // Create columns
    for (let i = 0; i < columns; i++) {
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.style.left = (i * fontSize) + 'px';
        
        // Even lines go up, odd lines go down
        if (i % 2 === 0) {
            line.style.top = '-' + Math.floor(Math.random() * 100) + 'px';
            line.style.animation = `fallUp ${(Math.random() * 8 + 4)}s linear infinite`;
        } else {
            line.style.bottom = '-' + Math.floor(Math.random() * 100) + 'px';
            line.style.animation = `fallDown ${(Math.random() * 8 + 4)}s linear infinite`;
        }
        
        // Add random characters
        const charCount = Math.floor(height / fontSize) + 1;
        for (let j = 0; j < charCount; j++) {
            const char = document.createElement('span');
            char.textContent = chars[Math.floor(Math.random() * chars.length)];
            char.style.opacity = Math.random() * 0.5 + 0.3;
            line.appendChild(char);
        }
        
        matrix.appendChild(line);
    }
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fallUp {
            to {
                top: ${height}px;
            }
        }
        @keyframes fallDown {
            to {
                bottom: ${height}px;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Update characters periodically
    setInterval(() => {
        const lines = document.querySelectorAll('.matrix-line');
        lines.forEach(line => {
            const chars = line.querySelectorAll('span');
            chars.forEach(char => {
                if (Math.random() > 0.97) {
                    char.textContent = chars[Math.floor(Math.random() * chars.length)];
                    char.style.opacity = Math.random() * 0.5 + 0.3;
                }
            });
        });
    }, 100);
    
    // Terminal typing effect
    const commands = document.querySelectorAll('.command');
    commands.forEach((cmd, index) => {
        cmd.style.visibility = 'hidden';
    });
    
    let currentCommand = 0;
    const typeNextCommand = () => {
        if (currentCommand < commands.length) {
            const cmd = commands[currentCommand];
            const text = cmd.textContent.replace('|', '');
            let i = 0;
            
            cmd.textContent = '';
            cmd.style.visibility = 'visible';
            
            const typing = setInterval(() => {
                if (i < text.length) {
                    cmd.textContent += text.charAt(i);
                    i++;
                } else {
                    clearInterval(typing);
                    cmd.innerHTML = text + '<span class="cursor">|</span>';
                    currentCommand++;
                    setTimeout(typeNextCommand, 500);
                }
            }, 50);
        }
    };
    
    // Start typing after a short delay
    setTimeout(typeNextCommand, 1000);
});