const bcrypt = require('bcryptjs');
const db = require('./database');

async function resetPasswords() {
    const users = [
        { email: 'admin@example.com', password: 'admin123' },
        { email: 'master@example.com', password: 'master123' }
    ];
    
    for (const user of users) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, user.email], function(err) {
            if (err) {
                console.error(`Error updating ${user.email}:`, err);
            } else {
                console.log(`Password reset for ${user.email}`);
            }
        });
    }
    
    setTimeout(() => {
        console.log('Password reset completed');
        process.exit(0);
    }, 1000);
}

resetPasswords();