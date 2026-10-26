import { isSupportedCountry, parsePhoneNumberFromString } from "libphonenumber-js/min";

const NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "yahoo.com.ph", "icloud.com", "me.com",
]);
const STAFF_ROLES = new Set(["cashier", "medical_technologist", "pathologist"]);
const RESULT_VALUE_TYPES = new Set(["numeric", "text", "select", "boolean", "structured"]);
const MAX_PRICE = 99_999_999.99;
const MAX_TURNAROUND_MINUTES = 30 * 24 * 60;
const MAX_AGE_DAYS = Math.round(120 * 365.25);

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isText(value, { required = false, max = Infinity } = {}) {
  return typeof value === "string" && (!required || Boolean(value.trim())) && value.length <= max;
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const today = new Date().toISOString().slice(0, 10);
  const earliest = new Date(`${today}T00:00:00.000Z`);
  earliest.setUTCFullYear(earliest.getUTCFullYear() - 120);
  return value <= today && value >= earliest.toISOString().slice(0, 10);
}

export function validateStaffDetails(body, { allowAdministrator = false } = {}) {
  const errors = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) return { body: "Provide staff details." };
  if (!STAFF_ROLES.has(body.role) && !(allowAdministrator && body.role === "administrator")) {
    errors.role = "Choose a supported staff role.";
  }

  for (const [field, required] of [["firstName", true], ["middleName", false], ["lastName", true]]) {
    const value = body[field];
    if (!required && (value == null || value === "")) continue;
    if (!isText(value, { required, max: 50 }) || (value && (value !== value.trim() || !NAME_PATTERN.test(value)))) {
      errors[field] = "Names must contain letters and single spaces only, and be no longer than 50 characters.";
    } else if (required && value.trim().length < 2) {
      errors[field] = "Names must be at least 2 characters.";
    }
  }

  if (!isValidDate(body.dateOfBirth)) errors.dateOfBirth = "Enter a valid date of birth within the last 120 years.";
  const countryCode = typeof body.countryCode === "string" ? body.countryCode.toUpperCase() : "";
  const phone = typeof body.phone === "string" && body.phone.length <= 32
    ? parsePhoneNumberFromString(body.phone)
    : undefined;
  if (!isSupportedCountry(countryCode) || !phone?.isValid() || phone.country !== countryCode) {
    errors.phone = "Enter a valid phone number for the selected country.";
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const emailDomain = email.slice(email.lastIndexOf("@") + 1);
  if (email.length > 254 || !EMAIL_PATTERN.test(email) || !PUBLIC_EMAIL_DOMAINS.has(emailDomain)) {
    errors.email = "Use a valid personal email address from a supported public email provider.";
  }
  if (!isText(body.country, { required: true, max: 100 })) errors.country = "Select a valid country.";
  if (!isText(body.city, { required: true, max: 100 }) || body.city.trim().length < 2) errors.city = "City must be between 2 and 100 characters.";
  if (!isText(body.houseNumber, { required: true, max: 30 })) errors.houseNumber = "House number is required and cannot exceed 30 characters.";
  if (!isText(body.street, { required: true, max: 100 }) || body.street.trim().length < 2) errors.street = "Street must be between 2 and 100 characters.";
  return errors;
}

export function validateStaffRoleChange({ currentRole, nextRole, isActive, isPendingActivation, hasActiveWork }) {
  if (currentRole === nextRole) return null;
  if (!STAFF_ROLES.has(currentRole) || !STAFF_ROLES.has(nextRole)) {
    return { code: "STAFF_ROLE_CHANGE_UNSUPPORTED", message: "Administrator account roles cannot be changed here." };
  }
  if (isActive) {
    return { code: "STAFF_ROLE_CHANGE_REQUIRES_INACTIVE", message: "Deactivate the account before changing its role." };
  }
  if (isPendingActivation) {
    return { code: "STAFF_ACTIVATION_PENDING", message: "This account must be activated before its role can be changed." };
  }
  if (hasActiveWork) {
    return { code: "STAFF_ROLE_CHANGE_HAS_ACTIVE_WORK", message: "Reassign the account’s active work before changing its role." };
  }
  return null;
}

export function validateCategoryDetails(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Provide category details.";
  if (!isText(body.name, { required: true, max: 120 }) || body.name.trim().length < 2) return "Category name must be between 2 and 120 characters.";
  if (body.description != null && !isText(body.description, { max: 1000 })) return "Category description cannot exceed 1000 characters.";
  return "";
}

function validPrice(value) {
  return (typeof value === "number" || (typeof value === "string" && value.trim() !== ""))
    && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= MAX_PRICE
    && /^\d{1,8}(?:\.\d{1,2})?$/.test(String(value));
}

function validateTestConfiguration(body) {
  if (body.specimens != null && !Array.isArray(body.specimens)) return "Specimens must be a list.";
  if (body.analytes != null && !Array.isArray(body.analytes)) return "Analytes must be a list.";
  if (body.specimens == null && body.analytes == null) return "";
  const specimens = body.specimens ?? [];
  const analytes = body.analytes ?? [];
  if (!specimens.length || !analytes.length) return "A test needs at least one specimen and one result parameter.";
  if (specimens.length > 50 || analytes.length > 50) return "A test can have no more than 50 specimen types or result parameters.";

  const specimenNames = [];
  for (const specimen of specimens) {
    if (!specimen || !isText(specimen.specimenType, { required: true, max: 100 })) return "Each specimen needs a type no longer than 100 characters.";
    specimenNames.push(specimen.specimenType.trim().toLowerCase());
    if (specimen.collectionInstructions != null && !isText(specimen.collectionInstructions, { max: 500 })) return "Collection instructions cannot exceed 500 characters.";
    if (specimen.quantityUnit != null && !isText(specimen.quantityUnit, { max: 40 })) return "Specimen quantity units cannot exceed 40 characters.";
    if (specimen.minimumQuantity != null && specimen.minimumQuantity !== ""
      && (!Number.isFinite(Number(specimen.minimumQuantity)) || Number(specimen.minimumQuantity) <= 0
        || Number(specimen.minimumQuantity) > 99_999_999.99 || !/^\d{1,8}(?:\.\d{1,2})?$/.test(String(specimen.minimumQuantity)))) {
      return "Minimum quantity must be a positive number.";
    }
    if (specimen.isRequired != null && typeof specimen.isRequired !== "boolean") return "Specimen required status must be true or false.";
  }
  if (new Set(specimenNames).size !== specimenNames.length) return "Specimen types must be unique.";

  const analyteKeys = new Set();
  for (const analyte of analytes) {
    if (!analyte || !isText(analyte.label, { required: true, max: 160 })) return "Each result parameter needs a label no longer than 160 characters.";
    if (analyte.key != null && !isText(analyte.key, { required: true, max: 80 })) return "Result parameter keys must be 1 to 80 characters.";
    const key = String(analyte.key ?? "").trim().toLowerCase();
    if (key && analyteKeys.has(key)) return "Result parameter keys must be unique.";
    if (key) analyteKeys.add(key);
    if (!RESULT_VALUE_TYPES.has(analyte.valueType)) return "Choose a supported result parameter type.";
    if (analyte.unit != null && !isText(analyte.unit, { max: 40 })) return "Result units cannot exceed 40 characters.";
    if (analyte.isRequired != null && typeof analyte.isRequired !== "boolean") return "Result parameter required status must be true or false.";
    const options = analyte.options ?? [];
    if (!Array.isArray(options) || ((analyte.valueType === "select" || analyte.valueType === "structured") && !options.length)) {
      return "Dropdown and structured parameters need configured options.";
    }
    if (options.some((option) => typeof option !== "string" || !option.trim() || option.length > 120)) return "Result options must be non-empty text no longer than 120 characters.";
    if (new Set(options.map((option) => option.trim().toLowerCase())).size !== options.length) return "Result options must be unique.";
    if (analyte.valueType === "structured" && (options.length < 2 || options.length > 20)) return "Structured results need between 2 and 20 columns.";
  }
  return "";
}

export function validateTestDetails(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Provide test details.";
  if (!partial || Object.hasOwn(body, "name")) {
    if (!isText(body.name, { required: true, max: 160 })) return "Test name is required and cannot exceed 160 characters.";
  }
  if (!partial || Object.hasOwn(body, "price")) {
    if (!validPrice(body.price)) return "Price must be from 0 to 99,999,999.99 with no more than two decimal places.";
  }
  if (Object.hasOwn(body, "turnaroundMinutes") && body.turnaroundMinutes != null && body.turnaroundMinutes !== "") {
    const minutes = Number(body.turnaroundMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_TURNAROUND_MINUTES) return "Turnaround time must be between 1 minute and 30 days.";
  }
  if (body.turnaroundMinutes != null && body.turnaroundMinutes !== "" && typeof body.turnaroundMinutes !== "number" && typeof body.turnaroundMinutes !== "string") {
    return "Turnaround time must be a number.";
  }
  if (body.isAvailable != null && typeof body.isAvailable !== "boolean") return "Availability must be true or false.";
  if (body.description != null && !isText(body.description, { max: 1000 })) return "Test description cannot exceed 1000 characters.";
  if (body.code != null && !isText(body.code, { required: true, max: 40 })) return "Test code must be 1 to 40 characters.";

  const hasCategories = Object.hasOwn(body, "categoryIds") || Object.hasOwn(body, "categoryId");
  if (!partial || hasCategories) {
    const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds : [body.categoryId];
    if (!categoryIds.length || categoryIds.length > 20 || categoryIds.some((id) => !isUuid(id))) return "Choose between 1 and 20 valid categories.";
    if (new Set(categoryIds).size !== categoryIds.length) return "Categories must be unique.";
  }
  return validateTestConfiguration(body);
}

export function validateReferenceRangeDetails(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Provide reference-range details.";
  if ((!partial || Object.hasOwn(body, "analyteId")) && !isUuid(body.analyteId)) return "Choose a valid result parameter.";
  if (Object.hasOwn(body, "sex") && body.sex !== null && !["female", "male"].includes(body.sex)) return "Choose All, Female, or Male.";
  if (!partial && !Object.hasOwn(body, "sex")) return "Choose a gender setting.";

  for (const field of ["minAgeDays", "maxAgeDays"]) {
    if (!Object.hasOwn(body, field)) {
      if (!partial) return "Provide both age limits.";
      continue;
    }
    if (!Number.isInteger(body[field]) || body[field] < 0 || body[field] > MAX_AGE_DAYS) return "Age limits must be whole days from 0 through 120 years.";
  }
  for (const field of ["lowerLimit", "upperLimit"]) {
    if (!Object.hasOwn(body, field)) {
      if (!partial) return "Provide both numeric limits.";
      continue;
    }
    if (typeof body[field] !== "number" || !Number.isFinite(body[field]) || Math.abs(body[field]) > 9_999_999_999.9999
      || Number(body[field].toFixed(4)) !== body[field]) return "Reference limits must be valid numeric values with no more than four decimal places.";
  }
  if (Object.hasOwn(body, "minAgeDays") && Object.hasOwn(body, "maxAgeDays") && body.minAgeDays > body.maxAgeDays) return "Minimum age cannot exceed maximum age.";
  if (Object.hasOwn(body, "lowerLimit") && Object.hasOwn(body, "upperLimit") && body.lowerLimit > body.upperLimit) return "Lower limit cannot exceed upper limit.";
  if (Object.hasOwn(body, "unit") && !isText(body.unit, { required: true, max: 40 })) return "Reference-range unit is required and cannot exceed 40 characters.";
  if (Object.hasOwn(body, "guidance") && body.guidance != null && !isText(body.guidance, { max: 2000 })) return "Guidance cannot exceed 2000 characters.";
  if (!partial && !Object.hasOwn(body, "unit")) return "Provide a reference-range unit.";
  return "";
}
