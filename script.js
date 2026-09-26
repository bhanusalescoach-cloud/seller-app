const API_URL = 'http://localhost:5000/api/auth';

document.addEventListener('DOMContentLoaded', () => {
    // 1. REGISTER FORM HANDLER
    const registerForm = document.querySelector('#register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Inputs ko unke TYPE se pakdo (Fail-proof)
            const inputs = registerForm.querySelectorAll('input');
            const username = inputs[0]?.value;
            const email = inputs[1]?.value;
            const password = inputs[2]?.value;

            try {
                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Registration Successful! Ab Login karein.');
                } else {
                    alert('Error: ' + (data.message || 'Registration failed'));
                }
            } catch (error) {
                alert('Server Connection Error!');
            }
        });
    }

    // 2. LOGIN FORM HANDLER
    const loginForm = document.querySelector('#login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const inputs = loginForm.querySelectorAll('input');
            const email = inputs[0]?.value;
            const password = inputs[1]?.value;

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Login Successful!');
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                } else {
                    alert('Error: ' + (data.message || 'Login failed'));
                }
            } catch (error) {
                alert('Server Connection Error!');
            }
        });
    }
});
