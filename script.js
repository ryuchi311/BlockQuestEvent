const form = document.getElementById("registration-form");
const message = document.getElementById("form-message");

function setMessage(text, type) {
  message.textContent = text;
  message.className = `form__message ${type}`;
}

function clearInvalidStates(elements) {
  for (const element of elements) {
    element.classList.remove("invalid");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const fullName = form.elements.fullName;
  const email = form.elements.email;
  const phone = form.elements.phone;
  const password = form.elements.password;
  const confirmPassword = form.elements.confirmPassword;
  const terms = form.elements.terms;
  const fields = [fullName, email, phone, password, confirmPassword, terms];

  clearInvalidStates(fields);

  const missing = fields.filter((field) => !field.checkValidity());
  if (missing.length > 0) {
    for (const field of missing) {
      field.classList.add("invalid");
    }
    setMessage("Please complete all required fields correctly.", "error");
    return;
  }

  if (password.value !== confirmPassword.value) {
    confirmPassword.classList.add("invalid");
    setMessage("Passwords do not match.", "error");
    return;
  }

  setMessage(`Thanks, ${fullName.value.trim()}! Your ticket request is submitted.`, "success");
  form.reset();
});