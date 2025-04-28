// Show form based on role (Employer or Employee)
function showRole(role) {
  document.getElementById('role-selection').classList.add('hidden');

  if (role === 'employer') {
    document.getElementById('employer-form').style.display = 'block';
    document.getElementById('employee-form').style.display = 'none';
  } else if (role === 'employee') {
    document.getElementById('employer-form').style.display = 'none';
    document.getElementById('employee-form').style.display = 'block';
  }
}

// Toggle password visibility
function togglePassword(fieldId, toggleIcon) {
  const passwordField = document.getElementById(fieldId);
  if (passwordField.type === 'password') {
    passwordField.type = 'text';
    toggleIcon.textContent = '👁️‍🗨️'; // Change to closed eye
  } else {
    passwordField.type = 'password';
    toggleIcon.textContent = '👁️'; // Change to open eye
  }
}

// Handle Employee Login
document.getElementById('employee-login-form')?.addEventListener('submit', function(event) {
  event.preventDefault();

  const formData = new FormData(this);
  const data = {
    username: formData.get('username'),
    password: formData.get('password')
  };

  console.log('Sending employee login request:', data);

  fetch('http://localhost:3001/employee-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(response => {
    if (response.status === 204) {
      return {}; // ✅ Return empty object for 204 No Content
    }
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(result => {
    console.log('Employee login response:', result);
    if (result.token && result.userId) {
      localStorage.setItem('token', result.token);
      localStorage.setItem('userId', result.userId);
      localStorage.setItem('role', 'employee'); // ✅ Store role
      window.location.href = 'employee.html'; 
    } else {
      Swal.fire({
        title: 'Login Failed',
        text: result.message || 'Invalid login credentials',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  })
  .catch(error => {
    console.error('Error during employee login:', error);
    Swal.fire({
      title: 'Error',
      text: 'An error occurred during login. Please try again.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
  });
});

// Handle Employer Login
const employerLoginForm = document.getElementById('employer-login-form');
if (employerLoginForm) {
  employerLoginForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const formData = new FormData(this);
    const data = {
      username: formData.get('username'),
      password: formData.get('password')
    };

    console.log('Sending employer login request:', data);

    fetch('http://localhost:3001/employer-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(response => {
      if (response.status === 204) {
        return {}; // ✅ Return empty object for 204 No Content
      }
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(result => {
      console.log('Employer login response:', result);
      if (result.token && result.userId) {
        localStorage.setItem('token', result.token);
        localStorage.setItem('userId', result.userId);
        localStorage.setItem('role', 'employer'); // ✅ Store role
        sessionStorage.setItem('employer_id', result.userId);
        window.location.href = 'employer.html'; 
      } else {
        Swal.fire({
          title: 'Login Failed',
          text: result.message || 'Invalid login credentials',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    })
    .catch(error => {
      console.error('Error during employer login:', error);
      Swal.fire({
        title: 'Error',
        text: 'An error occurred during login. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    });
  });
}
