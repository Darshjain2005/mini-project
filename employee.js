document.addEventListener('DOMContentLoaded', () => {
  // Fetch and display user data after login
  const userId = localStorage.getItem('user_id'); // Ensure user ID is saved during login
  if (userId) {
    fetch(`http://localhost:3001/get-profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    .then(response => response.json())
    .then(profile => {
      // Populate the profile fields with retrieved data
      if (document.getElementById('about-content')) {
        document.getElementById('about-content').innerText = profile.about_me || 'Your about me section is empty.';
      }
      if (document.getElementById('contact-info')) {
        document.getElementById('contact-info').innerText = `Email: ${profile.email}, LinkedIn: ${profile.linkedin}`;
      }
    })
    .catch(error => console.error('Error fetching profile:', error));
  }

  // Get the about me form and input field
  const aboutForm = document.getElementById('about-me-form');
  const aboutInputField = document.getElementById('about-me');

  if (aboutForm && aboutInputField) {
    aboutForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const userId = localStorage.getItem('userId');
      if (!userId || !validateUserId(userId)) {
        console.error('Invalid user ID');
        Swal.fire({
          icon: 'warning',
          title: 'Please Log In',
          text: 'Please log in to access this feature.',
          confirmButtonColor: '#008080'
        });
        return;
      }

      // Get the about me input
      const aboutInput = aboutInputField.value;
      console.log('About Me Input:', aboutInput);

      try {
        fetch('http://127.0.0.1:3001/update-about-me', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            user_id: userId,
            about_me_text: aboutInput
          })
        })
        .then(response => response.json())
        .then(data => {
          console.log('Data:', data);
          if (data.error) {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: data.error,
              confirmButtonColor: '#FF6347'
            });
          } else {
            if (document.getElementById('about-content')) {
              document.getElementById('about-content').innerText = aboutInput;
            }
            Swal.fire({
              icon: 'success',
              title: 'Success',
              text: 'About Me section updated successfully!',
              confirmButtonColor: '#008080'
            });
          }
        })
        .catch(error => {
          console.error('Error:', error);
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'An error occurred while updating your About Me section. Please try again.',
            confirmButtonColor: '#FF6347'
          });
        });
      } catch (error) {
        console.error('Error:', error);
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'An error occurred while updating your About Me section. Please try again.',
          confirmButtonColor: '#FF6347'
        });
      }
    });
  }

  // Validate user ID
  function validateUserId(userId) {
    // Add your own validation logic here
    return true; // or false if the user ID is invalid
  }

  // Function to display skills in the skills list
  function displaySkills(skills) {
    const skillsList = document.getElementById('skills-list');
    if (skillsList) {
      skillsList.innerHTML = ''; // Clear the list before appending new skills
      skills.forEach(skill => {
        const skillItem = document.createElement('div');
        skillItem.className = 'skill-item';
        skillItem.textContent = skill;
        skillsList.appendChild(skillItem);
      });
    }
  }

  // Define skillsForm
  const skillsForm = document.getElementById('skills-form');

  if (skillsForm) {
    // Skills Form Submission
    skillsForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const skillsInput = document.getElementById('skills-input');
      if (!skillsInput) return;

      const skillsInputValue = skillsInput.value.trim();
      const skillsArray = skillsInputValue.split('\n').map(skill => skill.trim()).filter(skill => skill !== '');

      if (skillsArray.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'No Skills Entered',
          text: 'Please enter at least one skill.',
        });
        return;
      }

      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');

      console.log('User  ID:', userId); // Log userId before sending
      console.log('Skills:', skillsArray); // Log skills before sending

      if (!token || !userId) {
        Swal.fire({
          icon: 'warning',
          title: 'Authentication Required',
          text: 'Authentication details are missing. Please log in.',
        });
        return;
      }

      try {
        let skillIds = [];

        // Step 1: Fetch or Insert Skills
        for (const skill of skillsArray) {
          try {
            const existingSkill = await fetch(`http://localhost:3001/get-skill-id?skill_name=${encodeURIComponent(skill.trim())}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
        
            if (existingSkill.ok) {
              const existingData = await existingSkill.json();
              skillIds.push(existingData.id);
            } else if (existingSkill.status === 404) {
              console.log(`Skill "${skill}" not found, creating new skill.`);
            } else {
              throw new Error(await existingSkill.text());
            }
          } catch (err) {
            console.error(`Error fetching skill "${skill}":`, err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: `Error fetching skill "${skill}": ${err.message}`,
            });
            return;
          }
        }

        // Step 2: Link all skills to the employee in one request
        const response = await fetch('http://localhost:3001/add-employee-skills', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            employee_id: userId,
            skill_names: skillsArray
          })
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        Swal.fire({
          icon: 'success',
          title: 'Skills Added',
          text: 'Skills added successfully!',
        });

        displaySkills(skillsArray);
        skillsInput.value = ''; // Clear input field

      } catch (error) {
        console.error('Error adding skill:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Error adding skill: ${error.message}`,
        });
      }
    });
  }

  // Projects Form Submission
  const projectForm = document.getElementById('project-form');
  if (projectForm) {
    projectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const projectTitle = document.getElementById('project-title');
      const projectDescription = document.getElementById('project-description');

      const userId = localStorage.getItem('userId'); // ✅ Get userId from localStorage

      if (!userId) {
        Swal.fire({
          icon: 'error',
          title: 'Not Logged In',
          text: 'User  is not logged in. Please log in first.',
        });
        return;
      }

      if (projectTitle && projectDescription) {
        const projectTitleValue = projectTitle.value.trim();
        const projectDescriptionValue = projectDescription.value.trim();

        if (!projectTitleValue || !projectDescriptionValue) {
          Swal.fire({
            icon: 'warning',
            title: 'Incomplete Fields',
            text: 'Please fill in both the project title and description.',
          });
          return;
        }

        // ✅ Send userId with the request
        fetch('http://localhost:3001/add-project', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            employee_id: userId,  // ✅ Corrected from user_id to employee_id (matches backend)
            title: projectTitleValue,
            description: projectDescriptionValue
          })
        })
        .then(response => {
          if (!response.ok) {
            return response.text().then(text => { throw new Error(text); });
          }
          return response.json(); // ✅ Expect JSON response
        })
        .then(data => {
          Swal.fire({
            icon: 'success',
            title: 'Project Added',
            text: 'Project added successfully: ' + data.message,
          }).then(() => {
            projectForm.reset(); // ✅ Reset form after successful submission
          });
        })
        .catch(error => {
          console.error('Error:', error);
          Swal.fire({
            icon: 'error',
            title: 'Submission Failed',
            text: 'Error adding project: ' + error.message,
          });
        });
      }
    });
  }

  // Certificate Form Submission
  const certificateForm = document.getElementById('certificate-form');
  if (certificateForm) {
    certificateForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Retrieve the userId from localStorage
      const userId = localStorage.getItem('userId');
      const certificateTitle = document.getElementById('certificate-title');
      const certificateFile = document.getElementById('certificate-file');

      if (certificateTitle && certificateFile) {
        const certificateTitleValue = certificateTitle.value.trim();
        const certificateFileValue = certificateFile.files[0]; // Get the uploaded file

        // Log userId to check its value
        console.log('User  ID before submitting:', userId);

        // Check if userId is set
        if (!userId) {
          console.error('User  ID is null. Please log in again.');
          Swal.fire({
            icon: 'error',
            title: 'User  Not Logged In',
            text: 'User  ID is not set. Please log in again.',
          });
          return;
        }

        // Log local storage values for debugging
        console.log('Local Storage before submitting:', localStorage);

        // Validate form inputs
        if (!certificateTitleValue || !certificateFileValue) {
          Swal.fire({
            icon: 'warning',
            title: 'Incomplete Fields',
            text: 'Please provide both a certificate title and a file.',
          });
          return;
        }

        // File size limit
        const MAX_FILE_SIZE_KB = 500;
        const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 1024;
        if (certificateFileValue.size > MAX_FILE_SIZE_BYTES) {
          Swal.fire({
            icon: 'warning',
            title: 'File Too Large',
            text: `File size exceeds ${MAX_FILE_SIZE_KB}KB. Please upload a smaller file.`,
          });
          return;
        }

        // Prepare form data
        const formData = new FormData();
        formData.append('employee_id', userId);
        formData.append('certificate_name', certificateTitleValue);
        formData.append('certificate_file', certificateFileValue);

        // Log the user ID to verify its value
        console.log('Submitting Certificate with User ID:', userId);

        // Show loading alert
        Swal.fire({
          title: 'Uploading...',
          text: 'Please wait while your certificate is being uploaded.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        // Send the form data to the server
        fetch('http://localhost:3001/add-certificate', {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}` // Include authorization token if necessary
          }
        })
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.statusText);
          }
          return response.text(); // Assuming the server returns a message as text
        })
        .then(data => {
          Swal.fire({
            icon: 'success',
            title: 'Upload Successful',
            text: 'Certificate uploaded successfully!',
          }).then(() => {
            certificateForm.reset(); // ✅ Reset form after successful submission
          });
          console.log('Certificate uploaded successfully.');
        })
        .catch(error => {
          console.error('Error uploading certificate:', error);
          Swal.fire({
            icon: 'error',
            title: 'Upload Failed',
            text: 'There was an error uploading your certificate: ' + error.message,
          });
        });
      }
    });
  }

  async function fetchCertificates() {
    try {
        const token = localStorage.getItem('token');
        console.log("Token:", token); // Debugging

        const response = await fetch('http://localhost:3001/api/certificates', { // ✅ Change 5000 → 3001
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        console.log("API Response:", data); // Debugging

        if (data.success && data.certificates.length > 0) {
            const certificateContainer = document.getElementById('certificates-list');
            certificateContainer.innerHTML = '';

            data.certificates.forEach(cert => {
                const certElement = document.createElement('div');
                certElement.classList.add('certificate-item');

                certElement.innerHTML = `
                    <p><strong>${cert.certificate_name}</strong></p>
                    <a href="http://localhost:3001${cert.certificate_file}" target="_blank">View Certificate</a>
                `;

                certificateContainer.appendChild(certElement);
            });
        } else {
            document.getElementById('certificates-list').innerHTML = '<p>No certificates uploaded.</p>';
        }
    } catch (error) {
        console.error('Error fetching certificates:', error);
    }
}

// Run function when the page loads
document.addEventListener('DOMContentLoaded', fetchCertificates);


  // Contact Form Submission
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const userId = localStorage.getItem('userId');
      // Check if user ID is valid
      if (!userId || !validateUserId(userId)) {
        console.error('Invalid user ID');
        alert('Please log in to access this feature'); // Alert for invalid user ID
        return;
      }

      const contactEmail = document.getElementById('contact-email');
      const contactLinkedIn = document.getElementById('contact-linkedin');
      
      if (contactEmail && contactLinkedIn) {
        const contactEmailValue = contactEmail.value;
        const contactLinkedInValue = contactLinkedIn.value;

        // Prepare the request
        fetch('http://localhost:3001/update-contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}` // Include authorization token
          },
          body: JSON.stringify({
            user_id: userId,
            contact_email: contactEmailValue,
            linkedin_profile: contactLinkedInValue  
          })
        })
        .then(response => response.json()) // Assuming the server returns JSON
        .then(data => {
          if (data.error) {
            alert(`Error: ${data.error}`); // Alert for error responses from server
          } else {
            // Update contact info display if applicable
            const contactInfoElement = document.getElementById('contact-info');
            if (contactInfoElement) {
              contactInfoElement.innerText = `Email: ${contactEmailValue}, LinkedIn: ${contactLinkedInValue}`;
            }
            alert(data.message || 'Contact information updated successfully!'); // Success alert
          }
        })
        .catch(error => {
          console.error('Error:', error);
          alert('An error occurred while updating your contact information. Please try again.'); // General error alert
        });
      } else {
        alert('Please ensure all fields are filled in correctly.'); // Alert if fields are missing
      }
    });
  }

  // Create Employee Form Submission
  const createEmployeeForm = document.getElementById('create-employee-form');

  if (createEmployeeForm) {
    createEmployeeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      const fullName = document.getElementById('employee-name').value.trim();
      const email = document.getElementById('employee-email').value.trim();
      const username = document.getElementById('employee-username').value.trim();
      const password = document.getElementById('employee-password').value.trim();
      const confirmPassword = document.getElementById('confirm-password').value.trim();
  
      // Email Validation
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
          Swal.fire({ title: "Invalid Email", text: "Enter a valid email address.", icon: "error" });
          return;
      }
  
      // Password Validation
      const passwordPattern = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordPattern.test(password)) {
          Swal.fire({
              title: "Weak Password",
              text: "Password must be at least 8 characters, contain an uppercase letter, a number, and a special character.",
              icon: "error"
          });
          return;
      }
  
      // Check Passwords Match
      if (password !== confirmPassword) {
          Swal.fire({ title: "Password Mismatch", text: "Passwords do not match.", icon: "error" });
          return;
      }
  
      // Prepare Data for Backend (DO NOT send confirmPassword)
      const employeeData = { fullname: fullName, email, username, password };
  
      try {
          document.getElementById('loading-indicator').style.display = 'block';
  
          const response = await fetch('http://localhost:3001/create-employee-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(employeeData)
          });
  
          const data = await response.json();
          document.getElementById('loading-indicator').style.display = 'none';
  
          if (!response.ok) throw new Error(data.message || 'Failed to create account.');
  
          Swal.fire({
              title: "Success!",
              text: "Employee account created successfully.",
              icon: "success"
          }).then(() => {
              createEmployeeForm.reset();
              window.location.replace('login.html');
          });
  
      } catch (error) {
          document.getElementById('loading-indicator').style.display = 'none';
          Swal.fire({ title: "Error", text: error.message || "Something went wrong.", icon: "error" });
      }
    });
  }

  // Fetch Recommendations
  function fetchRecommendations() {
    const employeeId = localStorage.getItem("user_id");

    if (!employeeId) {
        console.error("Employee ID not found in localStorage.");
        return;
    }

    fetch(`http://localhost:3001/get-recommendations/${employeeId}`)
        .then(response => response.json())
        .then(data => {
            const recommendationsList = document.getElementById("recommendations-list");
            recommendationsList.innerHTML = "";

            if (data.length === 0) {
                recommendationsList.innerHTML = "<p>No recommendations yet.</p>";
                return;
            }

            data.forEach(rec => {
                const recommendationItem = document.createElement("div");
                recommendationItem.classList.add("recommendation-item");
                recommendationItem.innerHTML = `
                    <p><strong>${rec.company_name}:</strong> ${rec.message} (⭐ ${rec.rating})</p>
                    <small>Received on: ${new Date(rec.created_at).toLocaleDateString()}</small>
                `;
                recommendationsList.appendChild(recommendationItem);
            });
        })
        .catch(error => console.error("Error fetching recommendations:", error));
  }

  // Save Profile
  window.saveProfile = async function() {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      Swal.fire({
        title: "Error",
        text: "User  is not logged in.",
        icon: "error",
        confirmButtonText: "OK"
      });
      return;
    }

    const aboutMe = document.getElementById("about-me")?.value.trim() || "";
    const projectTitle = document.getElementById("project-title")?.value.trim() || "";
    const projectDescription = document.getElementById("project-description")?.value.trim() || "";
    const contactEmail = document.getElementById("contact-email")?.value.trim() || "";
    const contactLinkedIn = document.getElementById("contact-linkedin")?.value.trim() || ""; // ✅ Ensure no null value
    
    const profile = {
      user_id: userId,
      about_me_text: aboutMe,
      project_title: projectTitle,
      project_description: projectDescription,
      contact_email: contactEmail,
      linkedin_profile: contactLinkedIn || "" // ✅ Ensures an empty string instead of null
    };
    
    try {
      const response = await fetch("http://127.0.0.1:3001/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });

      if (!response.ok) {
        const errorData = await response.json(); // Try to get server error message
        throw new Error(errorData.error || "Error saving profile");
      }

      Swal.fire({
        title: "Success",
        text: "Profile updated successfully!",
        icon: "success",
        confirmButtonText: "OK"
      });

    } catch (error) {
      console.error("Error saving profile:", error);
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to save profile",
        icon: "error",
        confirmButtonText: "OK"
      });
    }
  };

  async function loadProfile() {
    const userId = localStorage.getItem("userId");

    if (!userId) {
        console.error("User not logged in.");
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:3001/get-profile?user_id=${userId}`);
        if (!response.ok) {
            throw new Error("Failed to fetch profile data");
        }

        const data = await response.json();
        console.log("Profile data:", data);

        document.getElementById("about-me").value = data.about_me_text || "";
        document.getElementById("project-title").value = data.project_title || "";
        document.getElementById("project-description").value = data.project_description || "";
        document.getElementById("contact-email").value = data.contact_email || "";
        document.getElementById("contact-linkedin").value = data.linkedin_profile || "";

        // ✅ Load Recommendations
        const recommendationList = document.getElementById("recommendationsList");
        if (recommendationList) {
            recommendationList.innerHTML = ""; // Clear previous data

            if (data.recommendations && data.recommendations.length > 0) {
                data.recommendations.forEach(rec => {
                    const recElement = document.createElement("div");
                    recElement.innerHTML = `<strong>${rec.employer_name}:</strong> ${rec.recommendation_text} (⭐ ${rec.rating || 'N/A'})`;
                    recommendationList.appendChild(recElement);
                });
            } else {
                recommendationList.innerHTML = "<p>No recommendations available</p>";
            }
        }

        // ✅ Load Certificates
        loadCertificates(userId);

    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

// ✅ Fetch Certificates Function
async function loadCertificates(userId) {
  try {
      const token = localStorage.getItem("token"); 
      const response = await fetch(`http://127.0.0.1:3001/api/certificates`, {
          headers: {
              "Authorization": `Bearer ${token}`
          }
      });

      if (!response.ok) {
          throw new Error("Failed to fetch certificates");
      }

      const data = await response.json();
      console.log("Certificates:", data);

      const certificatesList = document.getElementById("certificates-list");
      certificatesList.innerHTML = ""; // Clear previous list

      if (data.certificates && data.certificates.length > 0) {
          data.certificates.forEach(cert => {
              let fixedPath = cert.certificate_file.replace(/\\/g, "/"); // Fix Windows backslashes

              // ✅ Ensure path does NOT contain extra "uploads/uploads/"
              fixedPath = fixedPath.replace(/^\/?uploads\/uploads\//, "uploads/");

              const certElement = document.createElement("div");
              certElement.innerHTML = `
                  <p><strong>${cert.certificate_name}</strong></p>
                  <a href="http://127.0.0.1:3001/${fixedPath}" target="_blank">View Certificate</a>
              `;
              certificatesList.appendChild(certElement);
          });
      } else {
          certificatesList.innerHTML = "<p>No certificates uploaded</p>";
      }

  } catch (error) {
      console.error("Error loading certificates:", error);
  }
}


// ✅ Load profile on page load
window.onload = loadProfile;

  // Logout function
  async function logout() {
    const userId = localStorage.getItem("userId"); // Fix missing variable

    if (!userId) {
      console.error("User  ID not found in localStorage.");
      return;
    }

    // Perform logout logic
    localStorage.removeItem("token");
    localStorage.removeItem("userId"); // ✅ Ensure consistency
    window.location.href = 'login.html'; // Redirect to login page
  }

  // Add event listener to logout button
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }
});