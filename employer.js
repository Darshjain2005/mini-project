document.addEventListener("DOMContentLoaded", () => {
    const createForm = document.getElementById("create-employer-form");
    const companyNameInput = document.getElementById("company-name");
    const emailInput = document.getElementById("employer-email");
    const usernameInput = document.getElementById("employer-username");
    const passwordInput = document.getElementById("employer-password");
    const eyeIcon = document.getElementById("toggle-password");
    const searchForm = document.getElementById("search-form");
    const searchResultsDiv = document.getElementById("search-results");
    const logoutButton = document.getElementById("logout-button");

    // 🔹 Fix: Password visibility toggle
    if (eyeIcon && passwordInput) {
        eyeIcon.addEventListener("click", () => {
            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                eyeIcon.src = "path/to/eye-open-icon.png"; // Make sure this path is correct
            } else {
                passwordInput.type = "password";
                eyeIcon.src = "path/to/eye-closed-icon.png"; // Make sure this path is correct
            }
        });
    }

    // 🔹 Fix: Employer account creation form submission
    if (createForm) {
        createForm.addEventListener("submit", async (event) => {
            event.preventDefault();
    
            const companyName = companyNameInput.value.trim();
            const email = emailInput.value.trim();
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
    
            if (!companyName || !email || !username || !password) {
                Swal.fire({
                    icon: "warning",
                    title: "Missing Fields",
                    text: "All fields are required!",
                });
                return;
            }
    
            try {
                const response = await fetch("http://localhost:3001/create-employer-account", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        company_name: companyName, 
                        email: email,
                        username: username,
                        password: password
                    })
                });
    
                const data = await response.json();
    
                if (!response.ok) {
                    throw new Error(data.message || "Account creation failed.");
                }
    
                // 🎉 Show success message using SweetAlert2
                Swal.fire({
                    icon: "success",
                    title: "Account Created",
                    text: "Your employer account has been successfully created!",
                    confirmButtonText: "OK",
                }).then(() => {
                    window.location.href = "login.html"; // Redirect after clicking OK
                });
    
            } catch (error) {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: `Error: ${error.message}`,
                });
            }
        });
    }
    

    // 🔹 Fix: Search Skills Dropdown (Fully functional)
    const skills = ["JavaScript", "Python", "Java", "C++", "React", "Node.js", "SQL", "Machine Learning"];
    const input = document.getElementById("search-skills");
    const dropdown = document.getElementById("skills-list");

    if (input && dropdown) {
        input.addEventListener("input", () => {
            const query = input.value.toLowerCase();
            dropdown.innerHTML = "";

            if (query) {
                const filteredSkills = skills.filter(skill => skill.toLowerCase().includes(query));

                filteredSkills.forEach(skill => {
                    const li = document.createElement("li");
                    li.textContent = skill;
                    li.style.padding = "10px";
                    li.style.cursor = "pointer";
                    li.style.listStyle = "none";
                    li.addEventListener("click", () => {
                        input.value = skill;
                        dropdown.style.display = "none";
                    });
                    dropdown.appendChild(li);
                });

                dropdown.style.display = filteredSkills.length ? "block" : "none";
            } else {
                dropdown.style.display = "none";
            }
        });

        // 🔹 Fix: Hide dropdown when clicking outside
        document.addEventListener("click", (event) => {
            if (event.target !== input) {
                dropdown.style.display = "none";
            }
        });
    }
});
