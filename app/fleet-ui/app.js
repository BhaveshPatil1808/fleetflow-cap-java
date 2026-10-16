
const API_BASE = "/odata/v4";

let currentUser = null;
let selectedVehicleID = null;

let odometerTripID = null;
let odometerMode = null;

/* =========================================================
   AUTHENTICATION
   ========================================================= */

function showLandingPage() {
    const landingPage = document.getElementById("landingPage");
    const loginPage = document.getElementById("loginPage");
    const appPage = document.getElementById("appPage");

    if (landingPage) landingPage.classList.remove("hidden");
    if (loginPage) loginPage.classList.add("hidden");
    if (appPage) appPage.classList.add("hidden");

    window.scrollTo({ top: 0, behavior: "auto" });
}

function openLoginPage(form = "login") {
    const landingPage = document.getElementById("landingPage");
    const loginPage = document.getElementById("loginPage");
    const appPage = document.getElementById("appPage");

    if (landingPage) landingPage.classList.add("hidden");
    if (appPage) appPage.classList.add("hidden");
    if (loginPage) loginPage.classList.remove("hidden");

    if (typeof showAuthForm === "function") {
        showAuthForm(form);
    }

    window.scrollTo({ top: 0, behavior: "auto" });
}



function showAuthForm(form) {
    document.getElementById("loginError").textContent = "";

    const registerError = document.getElementById("registerError");
    const registerSuccess = document.getElementById("registerSuccess");

    if (registerError) {
        registerError.textContent = "";
    }

    if (registerSuccess) {
        registerSuccess.textContent = "";
        registerSuccess.classList.add("hidden");
    }

    document.getElementById("loginForm").classList.toggle(
        "hidden",
        form !== "login"
    );

    document.getElementById("registerForm").classList.toggle(
        "hidden",
        form !== "register"
    );

    if (form === "register") {
        toggleRegistrationFields();
    }
}

function toggleRegistrationFields() {
    const role = document.getElementById("registerRole").value;

    document.getElementById("driverRegistrationFields").classList.toggle(
        "hidden",
        role !== "DRIVER"
    );
}

async function registerAccount() {
    const errorBox = document.getElementById("registerError");
    const successBox = document.getElementById("registerSuccess");
    const button = document.getElementById("registerButton");

    errorBox.textContent = "";
    successBox.textContent = "";
    successBox.classList.add("hidden");

    const firstName = document.getElementById("registerFirstName").value.trim();
    const lastName = document.getElementById("registerLastName").value.trim();
    const email = document.getElementById("registerEmail").value.trim().toLowerCase();
    const role = document.getElementById("registerRole").value;
    const password = document.getElementById("registerPassword").value;
    const confirmPassword =
        document.getElementById("registerConfirmPassword").value;

    const phone = document.getElementById("registerPhone").value.trim();
    const licenseNumber =
        document.getElementById("registerLicenseNumber").value.trim();
    const licenseExpiry =
        document.getElementById("registerLicenseExpiry").value;

    if (!firstName || !email || !password || !confirmPassword) {
        errorBox.textContent = "Please fill in all required fields.";
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorBox.textContent = "Please enter a valid email address.";
        return;
    }

    if (password.length < 8) {
        errorBox.textContent = "Password must contain at least 8 characters.";
        return;
    }

    if (password !== confirmPassword) {
        errorBox.textContent = "Passwords do not match.";
        return;
    }

    if (role === "DRIVER" && !licenseNumber) {
        errorBox.textContent = "Driving licence number is required for drivers.";
        return;
    }

    button.disabled = true;
    button.textContent = "Creating account...";

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                password,
                role,
                phone,
                licenseNumber,
                licenseExpiry: licenseExpiry || null
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.error?.message ||
                data.message ||
                "Registration failed. Please try again."
            );
        }

        successBox.textContent =
            `Account created successfully as ${role}. You can now log in.`;
        successBox.classList.remove("hidden");

        document.getElementById("username").value = email;
        document.getElementById("password").value = "";
        document.getElementById("registerPassword").value = "";
        document.getElementById("registerConfirmPassword").value = "";

        setTimeout(() => {
            showAuthForm("login");
            document.getElementById("username").value = email;
        }, 1200);

    } catch (error) {
        errorBox.textContent = error.message || "Unable to create account.";
    } finally {
        button.disabled = false;
        button.textContent = "Create Account";
    }
}

async function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const errorBox = document.getElementById("loginError");

    errorBox.textContent = "";

    if (!username || !password) {
        errorBox.textContent = "Please enter your username and password.";
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.error?.message ||
                data.message ||
                "Invalid username or password."
            );
        }

        currentUser = {
            username: data.username,
            role: data.role,
            authHeader: "Basic " + btoa(username + ":" + password)
        };

        sessionStorage.setItem(
            "fleetflowUser",
            JSON.stringify(currentUser)
        );

        showApplication();

    } catch (error) {
        errorBox.textContent = error.message || "Login failed.";
    }
}
/* =========================================================
   RESTORE SESSION
   ========================================================= */

function restoreSession() {
    const savedUser = sessionStorage.getItem("fleetflowUser");

    if (!savedUser) return;

    try {
        currentUser = JSON.parse(savedUser);

        if (
            currentUser &&
            currentUser.username &&
            currentUser.role &&
            currentUser.authHeader
        ) {
            showApplication();
        } else {
            sessionStorage.removeItem("fleetflowUser");
            currentUser = null;
        }
    } catch (error) {
        console.error("Session restore failed:", error);
        sessionStorage.removeItem("fleetflowUser");
        currentUser = null;
    }
}

/* =========================================================
   SHOW APPLICATION
   ========================================================= */


function showApplication() {
    // Hide the public landing page after login
    const landingPage = document.getElementById("landingPage");
    if (landingPage) {
        landingPage.classList.add("hidden");
    }

    // Hide the login/register page
    const loginPage = document.getElementById("loginPage");
    if (loginPage) {
        loginPage.classList.add("hidden");
    }

    // Display the authenticated application
    const appPage = document.getElementById("appPage");
    if (appPage) {
        appPage.classList.remove("hidden");
    }

    document.getElementById("welcomeUser").textContent =
        currentUser.username;

    document.getElementById("userRole").textContent =
        currentUser.role;

    configureNavigation();
    showDashboard();
}

/* =========================================================
   ROLE-BASED NAVIGATION
   ========================================================= */


function configureNavigation() {
    const navigationIds = [
        "vehiclesNav",
        "availableCarsNav",
        "tripsNav",
        "requestsNav",
        "tripHistoryNav",
        "billingNav",
        "analyticsNav",
        "fleetTrackingNav"
    ];

    navigationIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add("hidden");
        }
    });

    if (currentUser.role === "DRIVER") {
        document.getElementById("vehiclesNav").classList.remove("hidden");
        document.getElementById("requestsNav").classList.remove("hidden");
    }

    if (currentUser.role === "USER") {
        document.getElementById("availableCarsNav").classList.remove("hidden");
        document.getElementById("tripsNav").classList.remove("hidden");

        const historyNav = document.getElementById("tripHistoryNav");
        const billingNav = document.getElementById("billingNav");

        if (historyNav) historyNav.classList.remove("hidden");
        if (billingNav) billingNav.classList.remove("hidden");
    }

    if (currentUser.role === "ADMIN") {
        document.getElementById("analyticsNav")?.classList.remove("hidden");
        document.getElementById("fleetTrackingNav")?.classList.remove("hidden");
    }
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function showDashboard() {
    showPage("dashboardPage");

    document.getElementById("driverDashboard").classList.add("hidden");
    document.getElementById("userDashboard").classList.add("hidden");
    document.getElementById("adminDashboard").classList.add("hidden");

    if (currentUser.role === "DRIVER") {
        document.getElementById("driverDashboard").classList.remove("hidden");
        loadDriverDashboard();
    }

    if (currentUser.role === "USER") {
        document.getElementById("userDashboard").classList.remove("hidden");
    }

    if (currentUser.role === "ADMIN") {
        document.getElementById("adminDashboard").classList.remove("hidden");
    }
}

/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(pageId) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.add("hidden");
    });

    const page = document.getElementById(pageId);

    if (page) {
        page.classList.remove("hidden");
    }
}

/* =========================================================
   API HELPER
   ========================================================= */

async function apiRequest(url, options = {}) {
    if (!currentUser || !currentUser.authHeader) {
        throw new Error("Please log in again.");
    }

    const headers = {
        "Accept": "application/json",
        ...options.headers,
        "Authorization": currentUser.authHeader
    };

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (!response.ok) {
        let message = `HTTP ${response.status}`;

        try {
            const errorData = await response.json();

            if (errorData.error?.message) {
                const serverMessage = errorData.error.message;
                message = typeof serverMessage === "string"
                    ? serverMessage
                    : JSON.stringify(serverMessage);
            }
        } catch (error) {
            // Response was not JSON.
        }

        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    const responseText = await response.text();

    if (!responseText.trim()) {
        return null;
    }

    try {
        return JSON.parse(responseText);
    } catch (error) {
        return responseText;
    }
}

/* =========================================================
   DRIVER DASHBOARD
   ========================================================= */

async function loadDriverDashboard() {
    try {
        const [vehicles, response] = await Promise.all([
            getMyVehicles(),
            apiRequest(
                `${API_BASE}/driver/Trips?$orderby=tripDate desc`
            )
        ]);

        const trips = response?.value || [];

        document.getElementById("vehicleCount").textContent =
            vehicles.length;

        document.getElementById("pendingRequestCount").textContent =
            trips.filter(trip =>
                trip.status === "PENDING_CONFIRMATION"
            ).length;

        document.getElementById("activeTripCount").textContent =
            trips.filter(trip =>
                trip.status === "IN_PROGRESS"
            ).length;

    } catch (error) {
        console.error("Dashboard loading failed:", error);
    }
}

/* =========================================================
   VEHICLES
   ========================================================= */

async function getMyVehicles() {
    const data = await apiRequest(
        `${API_BASE}/driver/Vehicles?$expand=driver`
    );

    return data?.value || [];
}

async function loadMyVehicles() {
    const list = document.getElementById("vehicleList");

    list.innerHTML = `
        <div class="loading">Loading your vehicles...</div>
    `;

    try {
        const vehicles = await getMyVehicles();

        if (vehicles.length === 0) {
            list.innerHTML = `
                <div class="welcome-card">
                    <h2>No vehicles registered</h2>
                    <p>
                        You haven't registered any vehicles yet.
                        Register your first vehicle to get started.
                    </p>
                    <button class="primary-btn" onclick="showVehicleForm()">
                        + Register Vehicle
                    </button>
                </div>
            `;
            return;
        }

        list.innerHTML = vehicles.map(createVehicleCard).join("");

    } catch (error) {
        console.error("Loading vehicles failed:", error);

        list.innerHTML = `
            <div class="error-message">
                Failed to load vehicles: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

function createVehicleCard(vehicle) {
    const status = vehicle.status || "AVAILABLE";

    const statusClass = status === "AVAILABLE"
        ? "status-available"
        : "status-pending";

    return `
        <div class="vehicle-card">
            <h3>
                ${escapeHtml(vehicle.brand || "Vehicle")}
                ${escapeHtml(vehicle.model || "")}
            </h3>

            <div class="vehicle-detail">
                Registration:
                <strong>${escapeHtml(vehicle.registrationNumber || "-")}</strong>
            </div>

            <div class="vehicle-detail">
                Type: ${escapeHtml(vehicle.vehicleType || "-")}
            </div>

            <div class="vehicle-detail">
                Fuel: ${escapeHtml(vehicle.fuelType || "-")}
            </div>

            <div class="vehicle-detail">
                Current KM: ${escapeHtml(vehicle.currentKM ?? 0)}
            </div>

            <span class="status ${statusClass}">
                ${escapeHtml(status)}
            </span>
        </div>
    `;
}

function showVehicleForm() {
    document.getElementById("vehicleFormContainer").classList.remove("hidden");
    document.getElementById("vehicleMessage").innerHTML = "";
    document.getElementById("vehicleRegistration").focus();
}

function hideVehicleForm() {
    document.getElementById("vehicleFormContainer").classList.add("hidden");
    clearVehicleForm();
}

function clearVehicleForm() {
    [
        "vehicleRegistration",
        "vehicleType",
        "vehicleBrand",
        "vehicleModel",
        "vehicleFuelType",
        "vehiclePurchaseDate",
        "vehicleCurrentKM"
    ].forEach(id => {
        document.getElementById(id).value = "";
    });
}

async function registerVehicle() {
    const registrationNumber =
        document.getElementById("vehicleRegistration").value.trim();

    const vehicleType = document.getElementById("vehicleType").value;
    const brand = document.getElementById("vehicleBrand").value.trim();
    const model = document.getElementById("vehicleModel").value.trim();
    const fuelType = document.getElementById("vehicleFuelType").value;
    const purchaseDate = document.getElementById("vehiclePurchaseDate").value;
    const currentKMValue = document.getElementById("vehicleCurrentKM").value;

    if (!registrationNumber) {
        showVehicleMessage("Registration number is required.", false);
        return;
    }

    const currentKM = currentKMValue === "" ? 0 : Number(currentKMValue);

    if (!Number.isSafeInteger(currentKM) || currentKM < 0) {
        showVehicleMessage(
            "Current KM must be a non-negative whole number.",
            false
        );
        return;
    }

    const vehicleData = {
        registrationNumber,
        vehicleType: vehicleType || null,
        brand: brand || null,
        model: model || null,
        fuelType: fuelType || null,
        purchaseDate: purchaseDate || null,
        currentKM,
        status: "AVAILABLE"
    };

    try {
        await apiRequest(`${API_BASE}/driver/Vehicles`, {
            method: "POST",
            body: JSON.stringify(vehicleData)
        });

        showVehicleMessage("Vehicle registered successfully.", true);
        hideVehicleForm();

        await loadMyVehicles();
        await loadDriverDashboard();

    } catch (error) {
        console.error("Vehicle registration failed:", error);

        showVehicleMessage(
            "Vehicle registration failed: " + error.message,
            false
        );
    }
}

function showVehicleMessage(message, success) {
    const box = document.getElementById("vehicleMessage");

    box.innerHTML = `
        <div class="${success ? "success-message" : "error-message"}">
            ${escapeHtml(message)}
        </div>
    `;
}

/* =========================================================
   AVAILABLE CARS
   ========================================================= */

async function loadAvailableCars() {
    const list = document.getElementById("availableCarsList");

    list.innerHTML = `
        <div class="loading">Loading available cars...</div>
    `;

    try {
        const data = await apiRequest(
            `${API_BASE}/user/Vehicles` +
            `?$filter=status eq 'AVAILABLE'&$expand=driver`
        );

        const vehicles = data?.value || [];

        if (vehicles.length === 0) {
            list.innerHTML = `
                <div class="welcome-card">
                    <h2>No cars available</h2>
                    <p>There are currently no vehicles available for booking.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = vehicles.map(createAvailableVehicleCard).join("");

    } catch (error) {
        console.error("Loading available cars failed:", error);

        list.innerHTML = `
            <div class="error-message">
                Failed to load available cars: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

function createAvailableVehicleCard(vehicle) {
    const driver = vehicle.driver || {};

    const driverName =
        `${driver.firstName || ""} ${driver.lastName || ""}`.trim()
        || "Driver not available";

    return `
        <div class="vehicle-card">
            <h3>
                ${escapeHtml(vehicle.brand || "Vehicle")}
                ${escapeHtml(vehicle.model || "")}
            </h3>

            <div class="vehicle-detail">
                Registration:
                <strong>${escapeHtml(vehicle.registrationNumber || "-")}</strong>
            </div>

            <div class="vehicle-detail">
                Driver: ${escapeHtml(driverName)}
            </div>

            <div class="vehicle-detail">
                Vehicle Type: ${escapeHtml(vehicle.vehicleType || "-")}
            </div>

            <div class="vehicle-detail">
                Rate: <strong>₹15 / KM</strong>
            </div>

            <span class="status status-available">AVAILABLE</span>

            <button class="primary-btn card-btn"
                onclick="openBookingModal(
                    '${escapeJs(vehicle.ID)}',
                    '${escapeJs(vehicle.brand || "")}',
                    '${escapeJs(vehicle.model || "")}',
                    '${escapeJs(vehicle.registrationNumber || "")}'
                )">
                Book This Car
            </button>
        </div>
    `;
}

/* =========================================================
   BOOKING MODAL
   ========================================================= */

function openBookingModal(vehicleID, brand, model, registration) {
    selectedVehicleID = vehicleID;

    document.getElementById("selectedVehicleText").textContent =
        `${brand} ${model} - ${registration}`;

    document.getElementById("bookingError").textContent = "";
    document.getElementById("estimatedDistance").textContent = "0 KM";
    document.getElementById("estimatedPrice").textContent = "₹0";

    document.getElementById("bookingModal").classList.remove("hidden");
}

function closeBookingModal() {
    document.getElementById("bookingModal").classList.add("hidden");
    document.getElementById("bookingError").textContent = "";
    selectedVehicleID = null;
}

/* =========================================================
   CREATE TRIP REQUEST
   ========================================================= */

async function createTripRequest() {
    const errorBox = document.getElementById("bookingError");
    const button = document.querySelector(
        '#bookingModal button[onclick="createTripRequest()"]'
    );

    errorBox.textContent = "";

    if (!selectedVehicleID) {
        errorBox.textContent = "Please select a vehicle first.";
        return;
    }

    const startLocation =
        document.getElementById("tripStartLocation").value.trim();

    const endLocation =
        document.getElementById("tripEndLocation").value.trim();

    const tripDate = document.getElementById("tripDate").value;
    const purpose = document.getElementById("tripPurpose").value.trim();

    if (!startLocation || !endLocation || !tripDate) {
        errorBox.textContent =
            "Start location, destination and trip date are required.";
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Submitting...";
    }

    try {
        const tripData = {
            tripDate,
            startLocation,
            endLocation,
            purpose: purpose || null,
            vehicle_ID: selectedVehicleID,
            ratePerKM: 15
        };

        await apiRequest(`${API_BASE}/user/Trips`, {
            method: "POST",
            body: JSON.stringify(tripData)
        });

        closeBookingModal();

        document.getElementById("tripStartLocation").value = "";
        document.getElementById("tripEndLocation").value = "";
        document.getElementById("tripDate").value = "";
        document.getElementById("tripPurpose").value = "";

        showPage("tripsPage");
        await loadTrips();

    } catch (error) {
        console.error("Trip request failed:", error);

        errorBox.textContent =
            "Trip request failed: " + error.message;

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Request Trip";
        }
    }
}

/* =========================================================
   MY TRIPS
   ========================================================= */

async function loadTrips() {
    const list = document.getElementById("tripsList");

    if (!list) return;

    list.innerHTML = `
        <div class="loading">Loading your trips...</div>
    `;

    try {
        const data = await apiRequest(
            `${API_BASE}/user/Trips?$expand=vehicle,driver&$orderby=tripDate desc`
        );

        const trips = data?.value || [];

        if (trips.length === 0) {
            list.innerHTML = `
                <div class="welcome-card">
                    <h2>No trips yet</h2>
                    <p>Your trip requests will appear here after you book a vehicle.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = trips.map(trip => {
            const vehicle = trip.vehicle || {};
            const driver = trip.driver || {};

            const vehicleName =
                `${vehicle.brand || ""} ${vehicle.model || ""}`.trim()
                || vehicle.registrationNumber
                || "-";

            const driverName =
                `${driver.firstName || ""} ${driver.lastName || ""}`.trim()
                || "-";

            const status = trip.status || "UNKNOWN";

            return `
                <div class="vehicle-card">
                    <h3>
                        ${escapeHtml(trip.startLocation || "-")}
                        &rarr;
                        ${escapeHtml(trip.endLocation || "-")}
                    </h3>

                    <p><strong>Trip Date:</strong> ${escapeHtml(trip.tripDate || "-")}</p>
                    <p><strong>Purpose:</strong> ${escapeHtml(trip.purpose || "-")}</p>
                    <p><strong>Vehicle:</strong> ${escapeHtml(vehicleName)}</p>
                    <p><strong>Registration:</strong> ${escapeHtml(vehicle.registrationNumber || "-")}</p>
                    <p><strong>Driver:</strong> ${escapeHtml(driverName)}</p>
                    <p><strong>Estimated Distance:</strong> ${escapeHtml(trip.estimatedDistance ?? "-")} KM</p>
                    <p><strong>Estimated Price:</strong> ₹${escapeHtml(trip.estimatedPrice ?? "0")}</p>

                    ${trip.startMeter != null
                        ? `<p><strong>Starting Odometer:</strong> ${escapeHtml(trip.startMeter)} KM</p>`
                        : ""}

                    ${trip.endMeter != null
                        ? `<p><strong>Ending Odometer:</strong> ${escapeHtml(trip.endMeter)} KM</p>`
                        : ""}

                    ${trip.actualDistance != null
                        ? `<p><strong>Actual Distance:</strong> ${escapeHtml(trip.actualDistance)} KM</p>`
                        : ""}

                    ${trip.finalPrice != null
                        ? `<p><strong>Final Price:</strong> ₹${escapeHtml(trip.finalPrice)}</p>`
                        : ""}

                    ${status === "REJECTED" && trip.rejectionReason
                        ? `<p><strong>Rejection Reason:</strong> ${escapeHtml(trip.rejectionReason)}</p>`
                        : ""}

                    <span class="status ${getTripStatusClass(status)}">
                        ${escapeHtml(status.replace(/_/g, " "))}
                    </span>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Loading My Trips failed:", error);

        list.innerHTML = `
            <div class="error-message">
                Failed to load your trips: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

/* =========================================================
   DRIVER TRIP REQUESTS
   ========================================================= */

async function loadTripRequests() {
    const list = document.getElementById("requestsList");

    if (!list) return;

    list.innerHTML = `
        <div class="loading">Loading trip requests...</div>
    `;

    try {
        const data = await apiRequest(
            `${API_BASE}/driver/Trips?$expand=vehicle&$orderby=tripDate asc`
        );

        const trips = data?.value || [];

        const visibleTrips = trips.filter(trip =>
            [
                "PENDING_CONFIRMATION",
                "APPROVED",
                "IN_PROGRESS",
                "COMPLETED",
                "REJECTED"
            ].includes(trip.status)
        );

        if (visibleTrips.length === 0) {
            list.innerHTML = `
                <div class="welcome-card">
                    <h2>No trips found</h2>
                    <p>Trip requests assigned to you will appear here.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = visibleTrips.map(trip => {
            const vehicle = trip.vehicle || {};

            const vehicleName =
                `${vehicle.brand || ""} ${vehicle.model || ""}`.trim()
                || vehicle.registrationNumber
                || "-";

            const status = trip.status || "UNKNOWN";
            let actions = "";

            if (status === "PENDING_CONFIRMATION") {
                actions = `
                    <div class="trip-action-buttons">
                        <button class="primary-btn"
                            onclick="approveTrip('${escapeJs(trip.ID)}')">
                            Approve
                        </button>

                        <button class="reject-btn"
                            onclick="rejectTrip('${escapeJs(trip.ID)}')">
                            Reject
                        </button>
                    </div>
                `;
            } else if (status === "APPROVED") {
                actions = `
                    <div class="trip-action-buttons">
                        <button class="primary-btn"
                            onclick="startTrip('${escapeJs(trip.ID)}')">
                            Start Trip
                        </button>
                    </div>
                `;
            } else if (status === "IN_PROGRESS") {
                actions = `
                    <div class="trip-action-buttons">
                        <button class="primary-btn"
                            onclick="completeTrip('${escapeJs(trip.ID)}')">
                            Complete Trip
                        </button>
                    </div>
                `;
            }

            return `
                <div class="vehicle-card">
                    <h3>
                        ${escapeHtml(trip.startLocation || "-")}
                        &rarr;
                        ${escapeHtml(trip.endLocation || "-")}
                    </h3>

                    <p><strong>Date:</strong> ${escapeHtml(trip.tripDate || "-")}</p>
                    <p><strong>Vehicle:</strong> ${escapeHtml(vehicleName)}</p>
                    <p><strong>Registration:</strong> ${escapeHtml(vehicle.registrationNumber || "-")}</p>
                    <p><strong>Estimated Distance:</strong> ${escapeHtml(trip.estimatedDistance ?? "-")} KM</p>
                    <p><strong>Estimated Price:</strong> ₹${escapeHtml(trip.estimatedPrice ?? "0")}</p>

                    ${trip.startMeter != null
                        ? `<p><strong>Starting Odometer:</strong> ${escapeHtml(trip.startMeter)} KM</p>`
                        : ""}

                    ${trip.endMeter != null
                        ? `<p><strong>Ending Odometer:</strong> ${escapeHtml(trip.endMeter)} KM</p>`
                        : ""}

                    ${trip.actualDistance != null
                        ? `<p><strong>Actual Distance:</strong> ${escapeHtml(trip.actualDistance)} KM</p>`
                        : ""}

                    ${trip.finalPrice != null
                        ? `<p><strong>Final Price:</strong> ₹${escapeHtml(trip.finalPrice)}</p>`
                        : ""}

                    ${status === "REJECTED" && trip.rejectionReason
                        ? `<p><strong>Rejection Reason:</strong> ${escapeHtml(trip.rejectionReason)}</p>`
                        : ""}

                    <span class="status ${getTripStatusClass(status)}">
                        ${escapeHtml(status.replace(/_/g, " "))}
                    </span>

                    ${actions}
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Loading driver trips failed:", error);

        list.innerHTML = `
            <div class="error-message">
                Failed to load driver trips: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

/* =========================================================
   TRIP HISTORY
   ========================================================= */

async function getCurrentUserTrips() {
    const endpoint = currentUser.role === "DRIVER"
        ? `${API_BASE}/driver/Trips?$expand=vehicle&$orderby=tripDate desc`
        : `${API_BASE}/user/Trips?$expand=vehicle,driver&$orderby=tripDate desc`;

    const data = await apiRequest(endpoint);
    return data?.value || [];
}

function formatCurrency(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function getTripVehicleName(trip) {
    const vehicle = trip.vehicle || {};

    return [
        vehicle.brand || "",
        vehicle.model || ""
    ].join(" ").trim() || vehicle.registrationNumber || "Vehicle details unavailable";
}

async function loadTripHistory() {
    const list = document.getElementById("tripHistoryList");
    const summary = document.getElementById("tripHistorySummary");

    if (!list || !summary) return;

    list.innerHTML = '<div class="loading">Loading trip history...</div>';
    summary.innerHTML = "";

    try {
        const trips = await getCurrentUserTrips();

        const history = trips.filter(trip =>
            ["COMPLETED", "REJECTED"].includes(trip.status)
        );

        const completed = history.filter(
            trip => trip.status === "COMPLETED"
        );

        const totalDistance = completed.reduce(
            (sum, trip) => sum + (Number(trip.actualDistance) || 0),
            0
        );

        const totalFinalAmount = completed.reduce(
            (sum, trip) => sum + (Number(trip.finalPrice) || 0),
            0
        );

        summary.innerHTML = `
            <div class="stat-card">
                <span class="stat-title">Completed Trips</span>
                <strong>${completed.length}</strong>
            </div>
            <div class="stat-card">
                <span class="stat-title">Actual Distance</span>
                <strong>${escapeHtml(totalDistance)} KM</strong>
            </div>
            <div class="stat-card">
                <span class="stat-title">Final Trip Charges</span>
                <strong>${escapeHtml(formatCurrency(totalFinalAmount))}</strong>
            </div>
        `;

        if (history.length === 0) {
            list.innerHTML = `
                <div class="welcome-card">
                    <h2>No trip history yet</h2>
                    <p>Completed and rejected trips will appear here.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = history.map(trip => {
            const status = trip.status || "UNKNOWN";
            const isCompleted = status === "COMPLETED";

            return `
                <div class="vehicle-card">
                    <h3>
                        ${escapeHtml(trip.startLocation || "-")}
                        &rarr;
                        ${escapeHtml(trip.endLocation || "-")}
                    </h3>

                    <p><strong>Trip Date:</strong>
                        ${escapeHtml(trip.tripDate || "-")}</p>

                    <p><strong>Vehicle:</strong>
                        ${escapeHtml(getTripVehicleName(trip))}</p>

                    <p><strong>Actual Distance:</strong>
                        ${isCompleted && trip.actualDistance != null
                            ? escapeHtml(trip.actualDistance) + " KM"
                            : "Not available"}</p>

                    <p><strong>Final Charge:</strong>
                        ${isCompleted && trip.finalPrice != null
                            ? escapeHtml(formatCurrency(trip.finalPrice))
                            : "Not applicable"}</p>

                    ${status === "REJECTED" && trip.rejectionReason
                        ? `<p><strong>Rejection Reason:</strong>
                            ${escapeHtml(trip.rejectionReason)}</p>`
                        : ""}

                    <span class="status ${getTripStatusClass(status)}">
                        ${escapeHtml(status.replace(/_/g, " "))}
                    </span>

                    ${isCompleted
                        ? `<button class="secondary-btn"
                            onclick="showPage('billingPage'); loadBilling()">
                            View Billing
                           </button>`
                        : ""}
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Trip history loading failed:", error);

        list.innerHTML = `
            <div class="error-message">
                Failed to load trip history: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

/* =========================================================
   BILLING
   ========================================================= */

async function payForTrip(tripID, button) {
    if (!window.Razorpay) {
        alert("Razorpay Checkout could not load. Please refresh and try again.");
        return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Opening checkout...";

    try {
        const order = await apiRequest("/api/payments/order", {
            method: "POST",
            body: JSON.stringify({ tripID })
        });

        const checkout = new window.Razorpay({
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: "FleetFlow",
            description: `Invoice ${order.invoiceNumber}`,
            order_id: order.orderId,
            prefill: {
                name: order.customerName,
                email: order.customerEmail
            },
            theme: {
                color: "#2563eb"
            },
            handler: async function (response) {
                try {
                    const result = await apiRequest("/api/payments/verify", {
                        method: "POST",
                        body: JSON.stringify({
                            invoiceId: order.invoiceId,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });

                    if (result.status === "PAID") {
                        alert("Payment successful! Your invoice is marked as PAID.");
                    }

                    await loadBilling();
                } catch (error) {
                    alert(
                        "Payment verification is pending. Do not pay again yet. " +
                        "Please refresh Billing and check the payment status."
                    );
                    console.error("Payment verification failed:", error);
                }
            },
            modal: {
                ondismiss: function () {
                    button.disabled = false;
                    button.textContent = originalText;
                }
            }
        });

        checkout.on("payment.failed", function (response) {
            console.error("Razorpay payment failed:", response.error);
            alert("Payment failed. Please try again.");
            button.disabled = false;
            button.textContent = originalText;
        });

        checkout.open();
    } catch (error) {
        alert("Unable to start payment: " + error.message);
        button.disabled = false;
        button.textContent = originalText;
    }
}




async function downloadInvoicePdf(tripID, button) {
    if (!window.jspdf?.jsPDF) {
        alert("PDF library could not load. Please refresh the page and try again.");
        return;
    }

    const originalText = button?.textContent || "Download Invoice PDF";

    if (button) {
        button.disabled = true;
        button.textContent = "Generating PDF...";
    }

    try {
        // 1. Fetch the current user's trip and invoice records.
        const trips = await getCurrentUserTrips();
        const trip = trips.find(item => item.ID === tripID);

        if (!trip || trip.status !== "COMPLETED") {
            throw new Error("Only completed trips can be invoiced.");
        }

        const invoiceResponse = await apiRequest(
            `${API_BASE}/payment/Invoices`
        );

        const invoices = invoiceResponse?.value || [];
        const invoice = invoices.find(item => item.trip_ID === trip.ID);

        // Payment information is optional and read-only here.
        let payment = null;

        if (invoice?.ID) {
            try {
                const paymentResponse = await apiRequest(
                    `${API_BASE}/payment/Payments`
                );

                const payments = (paymentResponse?.value || [])
                    .filter(item => item.invoice_ID === invoice.ID)
                    .sort((a, b) => {
                        const aPaid = String(a.status).toUpperCase() === "PAID";
                        const bPaid = String(b.status).toUpperCase() === "PAID";
                        return Number(bPaid) - Number(aPaid);
                    });

                payment = payments[0] || null;
            } catch (error) {
                console.warn(
                    "Payment details are unavailable for this invoice.",
                    error
                );
            }
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const W = pdf.internal.pageSize.getWidth();
        const H = pdf.internal.pageSize.getHeight();
        const M = 15;
        const CW = W - M * 2;
        const FOOTER_Y = H - 13;

        const C = {
            navy: [19, 38, 70],
            blue: [43, 99, 210],
            paleBlue: [239, 245, 255],
            text: [40, 49, 63],
            muted: [105, 115, 130],
            line: [220, 226, 235],
            white: [255, 255, 255],
            green: [22, 120, 72],
            greenBg: [230, 247, 237],
            amber: [151, 92, 15],
            amberBg: [255, 246, 225],
            red: [176, 45, 45],
            redBg: [255, 235, 235],
            grayBg: [246, 248, 251]
        };

        const customerName = [
            currentUser?.firstName,
            currentUser?.lastName
        ].filter(Boolean).join(" ") ||
            currentUser?.username ||
            "FleetFlow Customer";

        const customerEmail =
            currentUser?.email ||
            currentUser?.username ||
            "Not available";

        const invoiceNumber =
            invoice?.invoiceNumber || `FF-${trip.ID}`;

        const invoiceStatus =
            String(invoice?.status || "UNPAID").toUpperCase();

        const paymentStatus =
            String(payment?.status || invoiceStatus).toUpperCase();

        const rawAmount = invoice?.amount ?? trip.finalPrice;
        const amount = Number(rawAmount);

        if (
            rawAmount == null ||
            !Number.isFinite(amount) ||
            amount < 0
        ) {
            throw new Error("The final invoice amount is unavailable.");
        }

        const vehicle = trip.vehicle || {};
        const driver = trip.driver || {};

        const vehicleName = [
            vehicle.brand,
            vehicle.model
        ].filter(Boolean).join(" ") || "Not available";

        const driverName = [
            driver.firstName,
            driver.lastName
        ].filter(Boolean).join(" ") || "Not available";

        const distance = Number(trip.actualDistance);
        const rate = Number(trip.ratePerKM);

        const hasDistance =
            trip.actualDistance != null &&
            Number.isFinite(distance) &&
            distance >= 0;

        const hasRate =
            trip.ratePerKM != null &&
            Number.isFinite(rate) &&
            rate >= 0;

        const formatMoney = value =>
            "INR " + Number(value).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

        const formatDate = value => {
            if (!value) return "Not available";

            const raw = String(value);
            const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
                ? new Date(raw + "T00:00:00")
                : new Date(raw);

            return Number.isNaN(parsed.getTime())
                ? raw
                : parsed.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                });
        };

        const setTextColor = color => pdf.setTextColor(...color);
        const setFillColor = color => pdf.setFillColor(...color);
        const setDrawColor = color => pdf.setDrawColor(...color);

        const wrapText = (value, width) =>
            pdf.splitTextToSize(String(value ?? "Not available"), width);

        let y = 0;

        // Each new page gets a compact continuation header.
        function drawContinuationHeader() {
            setFillColor(C.navy);
            pdf.rect(0, 0, W, 17, "F");

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(12);
            setTextColor(C.white);
            pdf.text("FLEETFLOW", M, 11);

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            setTextColor([218, 228, 245]);
            pdf.text("INVOICE " + invoiceNumber, W - M, 11, {
                align: "right"
            });

            y = 25;
        }

        function drawFooter() {
            setDrawColor(C.line);
            pdf.setLineWidth(0.25);
            pdf.line(M, FOOTER_Y - 3, W - M, FOOTER_Y - 3);

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            setTextColor(C.muted);

            pdf.text(
                "FleetFlow | Fleet & Vehicle Management System",
                M,
                FOOTER_Y
            );

            pdf.text(
                "System-generated invoice",
                W / 2,
                FOOTER_Y,
                { align: "center" }
            );

            pdf.text(
                `Page ${pdf.internal.getCurrentPageInfo().pageNumber}`,
                W - M,
                FOOTER_Y,
                { align: "right" }
            );
        }

        function ensureSpace(height) {
            if (y + height > FOOTER_Y - 5) {
                drawFooter();
                pdf.addPage();
                drawContinuationHeader();
            }
        }

        function drawSection(title) {
            ensureSpace(14);

            setFillColor(C.paleBlue);
            pdf.roundedRect(M, y, CW, 8, 1.5, 1.5, "F");

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8.5);
            setTextColor(C.navy);
            pdf.text(title.toUpperCase(), M + 3, y + 5.3);

            y += 13;
        }

        function drawField(label, value, x, yy, width) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7.5);
            setTextColor(C.muted);
            pdf.text(String(label), x, yy);

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8.5);
            setTextColor(C.text);

            const lines = wrapText(value, width);
            pdf.text(lines, x, yy + 5);

            return 5 + lines.length * 4;
        }

        function drawInfoRow(left, right) {
            const leftLines = wrapText(left[1], 54).length;
            const rightLines = wrapText(right[1], 54).length;
            const rowHeight = Math.max(leftLines, rightLines) * 4 + 10;

            ensureSpace(rowHeight);

            drawField(left[0], left[1], M + 2, y, 54);
            drawField(right[0], right[1], W / 2 + 2, y, 54);

            y += rowHeight;
        }

        function drawStatusBadge(status, x, yy, maxWidth = 38) {
            const normalized = String(status || "UNPAID").toUpperCase();
            const isPaid = normalized === "PAID";
            const isFailed = [
                "FAILED",
                "CANCELLED",
                "REJECTED"
            ].includes(normalized);

            const bg = isPaid
                ? C.greenBg
                : isFailed
                    ? C.redBg
                    : C.amberBg;

            const fg = isPaid
                ? C.green
                : isFailed
                    ? C.red
                    : C.amber;

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7);

            const label = normalized.replace(/_/g, " ");
            const badgeWidth = Math.min(
                maxWidth,
                Math.max(22, pdf.getTextWidth(label) + 7)
            );

            setFillColor(bg);
            pdf.roundedRect(x, yy - 4, badgeWidth, 7, 2, 2, "F");

            setTextColor(fg);
            pdf.text(label, x + badgeWidth / 2, yy + 0.5, {
                align: "center",
                maxWidth: badgeWidth - 3
            });

            return badgeWidth;
        }

        // --------------------------------------------------
        // PREMIUM BRANDED HEADER
        // --------------------------------------------------
        setFillColor(C.navy);
        pdf.rect(0, 0, W, 40, "F");

        setFillColor(C.blue);
        pdf.rect(0, 37, W, 3, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(23);
        setTextColor(C.white);
        pdf.text("FLEETFLOW", M, 17);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        setTextColor([218, 228, 245]);
        pdf.text("FLEET & VEHICLE MANAGEMENT SYSTEM", M, 24);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        setTextColor(C.white);
        pdf.text("TRIP INVOICE", W - M, 15, { align: "right" });

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        setTextColor([218, 228, 245]);
        pdf.text("Invoice: " + invoiceNumber, W - M, 22, {
            align: "right"
        });

        drawStatusBadge(invoiceStatus, W - M - 38, 32, 38);

        // --------------------------------------------------
        // INVOICE METADATA
        // --------------------------------------------------
        y = 49;

        drawField("INVOICE DATE", formatDate(new Date()), M + 2, y, 60);
        drawField("TRIP DATE", formatDate(trip.tripDate), W / 2 + 2, y, 60);

        y += 16;
        setDrawColor(C.line);
        pdf.line(M, y, W - M, y);
        y += 8;

        // --------------------------------------------------
        // CUSTOMER DETAILS
        // --------------------------------------------------
        drawSection("Customer / Bill To");

        drawField("CUSTOMER NAME", customerName, M + 2, y, 75);
        drawField("CUSTOMER EMAIL / LOGIN", customerEmail, W / 2 + 2, y, 75);

        y += 15;

        // --------------------------------------------------
        // TRIP AND VEHICLE REPORT
        // --------------------------------------------------
        drawSection("Detailed Trip & Vehicle Report");

        drawInfoRow(
            ["Trip ID", trip.ID],
            ["Trip Status", trip.status || "Not available"]
        );

        drawInfoRow(
            ["Pickup Location", trip.startLocation || "Not available"],
            ["Destination", trip.endLocation || "Not available"]
        );

        drawInfoRow(
            ["Vehicle", vehicleName],
            ["Registration Number", vehicle.registrationNumber || "Not available"]
        );

        drawInfoRow(
            ["Vehicle Type", vehicle.vehicleType || "Not available"],
            ["Fuel Type", vehicle.fuelType || "Not available"]
        );

        drawInfoRow(
            ["Driver", driverName],
            ["Driver Contact", driver.phone || "Not available"]
        );

        drawInfoRow(
            [
                "Starting Odometer",
                trip.startMeter == null ? "Not recorded" : `${trip.startMeter} km`
            ],
            [
                "Ending Odometer",
                trip.endMeter == null ? "Not recorded" : `${trip.endMeter} km`
            ]
        );

        drawInfoRow(
            [
                "Actual Distance",
                hasDistance ? `${distance.toLocaleString("en-IN")} km` : "Not recorded"
            ],
            [
                "Rate per Kilometre",
                hasRate ? `${formatMoney(rate)} / km` : "Not recorded"
            ]
        );

        drawInfoRow(
            ["Trip Purpose", trip.purpose || "Not specified"],
            ["Estimated Price", trip.estimatedPrice == null
                ? "Not available"
                : formatMoney(Number(trip.estimatedPrice))]
        );

        // --------------------------------------------------
        // BILLING BREAKDOWN
        // --------------------------------------------------
        drawSection("Billing Breakdown");

        ensureSpace(30);

        setFillColor(C.grayBg);
        pdf.roundedRect(M, y - 3, CW, 9, 1, 1, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        setTextColor(C.navy);

        pdf.text("DESCRIPTION", M + 3, y + 2.5);
        pdf.text("AMOUNT", W - M - 3, y + 2.5, {
            align: "right"
        });

        y += 12;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        setTextColor(C.text);

        const chargeDescription = hasDistance && hasRate
            ? `Completed trip charge (${distance} km x ${formatMoney(rate)}/km)`
            : "Completed trip charge";

        pdf.text(wrapText(chargeDescription, CW - 45), M + 3, y);
        pdf.text(formatMoney(amount), W - M - 3, y, {
            align: "right"
        });

        y += 8;
        setDrawColor(C.line);
        pdf.line(M, y, W - M, y);
        y += 7;

        // Only display configured tax data. No tax is inferred.
        const taxLines = Array.isArray(invoice?.taxBreakdown)
            ? invoice.taxBreakdown.filter(item =>
                item &&
                item.label &&
                item.amount != null &&
                Number.isFinite(Number(item.amount))
            )
            : [];

        for (const tax of taxLines) {
            ensureSpace(8);

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8.5);
            setTextColor(C.muted);

            pdf.text(String(tax.label), M + 3, y);
            pdf.text(formatMoney(Number(tax.amount)), W - M - 3, y, {
                align: "right"
            });

            y += 6;
        }

        ensureSpace(20);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        setTextColor(C.navy);
        pdf.text("TOTAL INVOICE AMOUNT", M + 3, y + 2);

        setFillColor(C.navy);
        pdf.roundedRect(W / 2, y - 2, W / 2 - M, 13, 2, 2, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        setTextColor(C.white);
        pdf.text(formatMoney(amount), W - M - 4, y + 6.5, {
            align: "right"
        });

        y += 20;

        // --------------------------------------------------
        // PAYMENT INFORMATION
        // --------------------------------------------------
        drawSection("Payment Information");

        drawField("PAYMENT STATUS", "", M + 2, y, 55);
        drawStatusBadge(paymentStatus, M + 2, y + 8, 48);
        y += 15;

        if (payment?.razorpayOrderId) {
            const height = drawField(
                "RAZORPAY ORDER ID",
                payment.razorpayOrderId,
                M + 2,
                y,
                CW - 5
            );
            y += height + 3;
        }

        if (payment?.razorpayPaymentId) {
            const height = drawField(
                "RAZORPAY PAYMENT ID",
                payment.razorpayPaymentId,
                M + 2,
                y,
                CW - 5
            );
            y += height + 3;
        }

        if (!payment?.razorpayOrderId && !payment?.razorpayPaymentId) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            setTextColor(C.muted);
            pdf.text(
                "Razorpay payment reference is not available in the current records.",
                M + 2,
                y
            );
            y += 6;
        }

        const isPaid = paymentStatus === "PAID";

        ensureSpace(12);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        setTextColor(isPaid ? C.green : C.text);

        pdf.text(
            isPaid
                ? "Payment is marked PAID in FleetFlow records."
                : "If payment is due, open FleetFlow Billing and select Pay Now to complete checkout.",
            M + 2,
            y,
            { maxWidth: CW - 4 }
        );

        y += 11;

        // --------------------------------------------------
        // TERMS AND PAYMENT INSTRUCTIONS
        // --------------------------------------------------
        drawSection("Invoice Terms & Payment Instructions");

        const terms = [
            "This invoice is generated from the completed trip and available FleetFlow billing records.",
            "Please verify the trip route, vehicle, distance and billed amount.",
            "For unpaid invoices, use the Pay Now option in FleetFlow Billing to complete payment securely.",
            "Keep the invoice number and any available Razorpay reference for payment enquiries.",
            "Payment status displayed here reflects the current FleetFlow invoice/payment records."
        ];

        for (const term of terms) {
            const lines = wrapText("- " + term, CW - 5);
            const height = lines.length * 4 + 2;

            ensureSpace(height);

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            setTextColor(C.text);

            pdf.text(lines, M + 2, y);
            y += height;
        }

        y += 3;

        // --------------------------------------------------
        // CUSTOMER ACKNOWLEDGEMENT AND SIGNATURES
        // --------------------------------------------------
        drawSection("Customer Acknowledgement & Authorization");

        ensureSpace(29);

        const gap = 12;
        const sigWidth = (CW - gap) / 2;
        const leftX = M + 2;
        const rightX = M + sigWidth + gap;
        const sigY = y + 12;

        setDrawColor(C.muted);
        pdf.setLineWidth(0.3);

        pdf.line(leftX, sigY, leftX + sigWidth - 4, sigY);
        pdf.line(rightX, sigY, W - M - 2, sigY);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        setTextColor(C.text);

        pdf.text("Customer Signature", leftX, sigY + 5);
        pdf.text("Authorized Representative", rightX, sigY + 5);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        setTextColor(C.muted);

        pdf.text("Name / Date", leftX, sigY + 10);
        pdf.text("Name / Date", rightX, sigY + 10);

        // Add a footer to every page, including any continuation pages.
        const totalPages = pdf.internal.getNumberOfPages();

        for (let page = 1; page <= totalPages; page++) {
            pdf.setPage(page);
            drawFooter();
        }

        const safeName = String(invoiceNumber)
            .replace(/[^a-zA-Z0-9_-]/g, "_");

        pdf.save(`FleetFlow_${safeName}.pdf`);

    } catch (error) {
        console.error("Invoice PDF generation failed:", error);
        alert("Unable to generate invoice PDF: " + error.message);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}



async function loadBilling() {
    const list = document.getElementById("billingList");
    const summary = document.getElementById("billingSummary");

    if (!list || !summary) return;

    list.innerHTML = '<div class="loading">Loading billing details...</div>';
    summary.innerHTML = "";

    try {
        const trips = await getCurrentUserTrips();
        const completed = trips.filter(
            trip => trip.status === "COMPLETED"
        );

        const invoiceData = await apiRequest(
            `${API_BASE}/payment/Invoices`
        );
        const invoices = invoiceData?.value || [];

        const myInvoices = invoices.filter(invoice =>
            completed.some(trip => trip.ID === invoice.trip_ID)
        );

        const invoiceByTrip = new Map(
            myInvoices.map(invoice => [invoice.trip_ID, invoice])
        );

        const totalDistance = completed.reduce(
            (sum, trip) => sum + (Number(trip.actualDistance) || 0),
            0
        );

        const totalBilled = completed.reduce(
            (sum, trip) => sum + (Number(trip.finalPrice) || 0),
            0
        );

        summary.innerHTML = `
            <div class="stat-card">
                <span class="stat-title">Completed Trips</span>
                <strong>${completed.length}</strong>
            </div>
            <div class="stat-card">
                <span class="stat-title">Total Actual Distance</span>
                <strong>${escapeHtml(totalDistance)} KM</strong>
            </div>
            <div class="stat-card">
                <span class="stat-title">Total Final Charges</span>
                <strong>${escapeHtml(formatCurrency(totalBilled))}</strong>
            </div>
        `;

        if (completed.length === 0) {
            list.innerHTML = `
                <div class="welcome-card">
                    <h2>No bills available</h2>
                    <p>A bill will appear after a trip is completed.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = completed.map(trip => {
            const actualDistance = Number(trip.actualDistance);
            const finalPrice = Number(trip.finalPrice);
            const rate = trip.ratePerKM == null
                ? 15
                : Number(trip.ratePerKM);

            const invoice = invoiceByTrip.get(trip.ID);
            const paid = invoice?.status === "PAID";
            const paymentStatus = paid ? "PAID" : "UNPAID";

            return `
                <div class="vehicle-card billing-card">
                    <h3>Trip Bill</h3>

                    <p><strong>Trip ID:</strong>
                        ${escapeHtml(trip.ID || "-")}</p>

                    <p><strong>Trip Date:</strong>
                        ${escapeHtml(trip.tripDate || "-")}</p>

                    <p><strong>Route:</strong>
                        ${escapeHtml(trip.startLocation || "-")}
                        &rarr;
                        ${escapeHtml(trip.endLocation || "-")}</p>

                    <p><strong>Vehicle:</strong>
                        ${escapeHtml(getTripVehicleName(trip))}</p>

                    <p><strong>Starting Odometer:</strong>
                        ${trip.startMeter != null
                            ? escapeHtml(trip.startMeter) + " KM"
                            : "—"}</p>

                    <p><strong>Ending Odometer:</strong>
                        ${trip.endMeter != null
                            ? escapeHtml(trip.endMeter) + " KM"
                            : "—"}</p>

                    <p><strong>Actual Distance:</strong>
                        ${Number.isFinite(actualDistance)
                            ? escapeHtml(actualDistance) + " KM"
                            : "—"}</p>

                    <p><strong>Rate:</strong>
                        ${Number.isFinite(rate)
                            ? escapeHtml(formatCurrency(rate)) + " / KM"
                            : "—"}</p>

                    <p><strong>Estimated Price:</strong>
                        ${trip.estimatedPrice != null
                            ? escapeHtml(formatCurrency(trip.estimatedPrice))
                            : "—"}</p>

                    <div class="estimate-box">
                        <div>
                            <span>Final Trip Charge</span>
                            <strong>${Number.isFinite(finalPrice)
                                ? escapeHtml(formatCurrency(finalPrice))
                                : "Not available"}</strong>
                        </div>
                    </div>

                    <p><strong>Invoice:</strong>
                        ${escapeHtml(invoice?.invoiceNumber || "Trip invoice")}
                    </p>

                    <p><strong>Payment Status:</strong>
                        <span class="status ${paid
                            ? "status-completed"
                            : "status-pending"}">
                            ${paymentStatus}
                        </span>
                    </p>

                    ${paid ? `
                        <p>Your payment has been confirmed.</p>
                    ` : `
                        <button
                            type="button"
                            class="primary-btn"
                            onclick="payForTrip('${escapeHtml(trip.ID)}', this)">
                            Pay Now
                        </button>
                    `}

                    <button
                        type="button"
                        class="primary-btn"
                        onclick="downloadInvoicePdf('${escapeHtml(trip.ID)}', this)">
                        Download Invoice PDF
                    </button>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Billing loading failed:", error);

        list.innerHTML = `
            <div class="error-message">
                Failed to load billing details:
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}



function getTripStatusClass(status) {
    switch (status) {
        case "AVAILABLE":
            return "status-available";
        case "APPROVED":
        case "IN_PROGRESS":
            return "status-approved";
        case "COMPLETED":
            return "status-completed";
        case "REJECTED":
            return "status-rejected";
        default:
            return "status-pending";
    }
}

/* =========================================================
   APPROVE TRIP
   ========================================================= */

async function approveTrip(tripID) {
    if (!confirm("Are you sure you want to approve this trip?")) {
        return;
    }

    try {
        await apiRequest(`${API_BASE}/driver/approveTrip`, {
            method: "POST",
            body: JSON.stringify({ tripID })
        });

        await loadTripRequests();
        await loadDriverDashboard();

    } catch (error) {
        console.error("Trip approval failed:", error);
        alert("Could not approve trip: " + error.message);
    }
}

/* =========================================================
   REJECT TRIP
   ========================================================= */

async function rejectTrip(tripID) {
    const reason = prompt("Enter the reason for rejecting this trip:");

    if (reason === null) return;

    if (!reason.trim()) {
        alert("A rejection reason is required.");
        return;
    }

    if (reason.trim().length > 255) {
        alert("Rejection reason cannot exceed 255 characters.");
        return;
    }

    try {
        await apiRequest(`${API_BASE}/driver/rejectTrip`, {
            method: "POST",
            body: JSON.stringify({
                tripID,
                reason: reason.trim()
            })
        });

        await loadTripRequests();
        await loadDriverDashboard();

    } catch (error) {
        console.error("Trip rejection failed:", error);
        alert("Could not reject trip: " + error.message);
    }
}

/* =========================================================
   ODOMETER MODAL
   ========================================================= */

function startTrip(tripID) {
    openOdometerModal("START", tripID);
}

function completeTrip(tripID) {
    openOdometerModal("COMPLETE", tripID);
}

function openOdometerModal(mode, tripID) {
    odometerMode = mode;
    odometerTripID = tripID;

    const modal = document.getElementById("odometerModal");
    const form = document.getElementById("odometerForm");
    const title = document.getElementById("odometerModalTitle");
    const description = document.getElementById("odometerModalDescription");
    const label = document.getElementById("odometerLabel");
    const input = document.getElementById("odometerReading");
    const submitButton = document.getElementById("odometerSubmitBtn");
    const error = document.getElementById("odometerError");

    form.reset();
    error.textContent = "";
    submitButton.disabled = false;

    if (mode === "START") {
        title.textContent = "Start Trip";
        description.textContent =
            "Enter the current odometer reading before starting the trip.";
        label.textContent = "Starting Odometer Reading (KM) *";
        input.placeholder = "e.g. 12500";
        submitButton.textContent = "Start Trip";
    } else {
        title.textContent = "Complete Trip";
        description.textContent =
            "Enter the final odometer reading to complete the trip.";
        label.textContent = "Final Odometer Reading (KM) *";
        input.placeholder = "e.g. 12620";
        submitButton.textContent = "Complete Trip";
    }

    modal.classList.remove("hidden");

    setTimeout(() => input.focus(), 50);
}

function closeOdometerModal() {
    document.getElementById("odometerModal").classList.add("hidden");
    document.getElementById("odometerForm").reset();
    document.getElementById("odometerError").textContent = "";
    document.getElementById("odometerSubmitBtn").disabled = false;

    odometerTripID = null;
    odometerMode = null;
}

async function submitOdometerReading(event) {
    event.preventDefault();

    const input = document.getElementById("odometerReading");
    const error = document.getElementById("odometerError");
    const submitButton = document.getElementById("odometerSubmitBtn");

    error.textContent = "";

    if (!odometerTripID || !odometerMode) {
        error.textContent = "Trip details are missing. Please reopen the form.";
        return;
    }

    const value = input.value.trim();
    const reading = Number(value);

    if (
        value === "" ||
        !Number.isSafeInteger(reading) ||
        reading < 0
    ) {
        error.textContent =
            "Enter a valid non-negative whole-number odometer reading.";
        input.focus();
        return;
    }

    const tripID = odometerTripID;
    const mode = odometerMode;

    submitButton.disabled = true;
    submitButton.textContent =
        mode === "START" ? "Starting..." : "Completing...";

    try {
        if (mode === "START") {
            await apiRequest(`${API_BASE}/driver/startTrip`, {
                method: "POST",
                body: JSON.stringify({
                    tripID,
                    startMeter: reading
                })
            });
        } else {
            await apiRequest(`${API_BASE}/driver/completeTrip`, {
                method: "POST",
                body: JSON.stringify({
                    tripID,
                    endMeter: reading
                })
            });
        }

        closeOdometerModal();

        await loadTripRequests();
        await loadDriverDashboard();

    } catch (error) {
        console.error("Odometer submission failed:", error);

        error.textContent =
            error.message || "Unable to update the trip. Please try again.";

        submitButton.disabled = false;
        submitButton.textContent =
            mode === "START" ? "Start Trip" : "Complete Trip";
    }
}

/* =========================================================
   LOGOUT
   ========================================================= */

function logout() {
    sessionStorage.removeItem("fleetflowUser");
    currentUser = null;
    window.location.reload();
}

/* =========================================================
   HTML / JAVASCRIPT HELPERS
   ========================================================= */

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJs(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
}



/* =========================================================
   AI FLEET ANALYTICS
   Uses existing CAP AdminService endpoints.
   ========================================================= */

let fleetAnalyticsData = {
    trips: [],
    vehicles: [],
    drivers: []
};

async function loadFleetAnalytics() {
    const message = document.getElementById("analyticsMessage");
    const summary = document.getElementById("analyticsSummary");
    const insights = document.getElementById("analyticsInsights");

    if (!message || !summary || !insights) {
        console.error("Analytics HTML elements are missing.");
        return;
    }

    message.textContent = "Loading fleet data...";
    insights.innerHTML = "<p>Analyzing fleet activity...</p>";

    try {
        // Restrict this dashboard to administrators.
        if (!currentUser || currentUser.role !== "ADMIN") {
            throw new Error("Only administrators can access fleet analytics.");
        }

        const [tripResponse, vehicleResponse, driverResponse] =
            await Promise.all([
                apiRequest(`${API_BASE}/admin/Trips?$top=5000`),
                apiRequest(`${API_BASE}/admin/Vehicles?$top=5000`),
                apiRequest(`${API_BASE}/admin/Drivers?$top=5000`)
            ]);

        fleetAnalyticsData = {
            trips: tripResponse?.value || [],
            vehicles: vehicleResponse?.value || [],
            drivers: driverResponse?.value || []
        };

        renderFleetAnalytics();

        message.textContent =
            `Analytics updated successfully. ` +
            `${fleetAnalyticsData.trips.length} trips, ` +
            `${fleetAnalyticsData.vehicles.length} vehicles and ` +
            `${fleetAnalyticsData.drivers.length} drivers loaded.`;

    } catch (error) {
        console.error("Fleet analytics failed:", error);
        message.textContent = `Unable to load analytics: ${error.message}`;
        summary.innerHTML = `
            <div class="stat-card">
                <span class="stat-title">Analytics Status</span>
                <strong>Unavailable</strong>
            </div>
        `;
        insights.innerHTML =
            "<p>Check the AdminService endpoints and try refreshing.</p>";
    }
}


async function askFleetAnalytics() {
    const questionInput = document.getElementById("analyticsQuestion");
    const answerBox = document.getElementById("analyticsAnswer");

    if (!questionInput || !answerBox) return;

    const question = questionInput.value.trim();

    if (!question) {
        answerBox.textContent =
            "Please enter a question about your fleet.";
        answerBox.classList.remove("hidden");
        return;
    }

    if (!currentUser || currentUser.role !== "ADMIN") {
        answerBox.textContent =
            "Administrator access is required.";
        answerBox.classList.remove("hidden");
        return;
    }

    answerBox.textContent =
        "FleetFlow AI is analyzing live fleet data...";
    answerBox.classList.remove("hidden");

    try {
        // Send only the question.
        // Fleet statistics will be retrieved by the backend.
        const result = await apiRequest("/api/fleet-ai/ask", {
            method: "POST",
            body: JSON.stringify({ question })
        });

        if (!result || !result.answer) {
            throw new Error("The AI service returned no answer.");
        }

        answerBox.innerHTML = renderFleetAIAnswer(result.answer);

    } catch (error) {
        console.error("FleetFlow AI request failed:", error);

        answerBox.textContent =
            "Unable to get an AI response. Please try again.";
    }
}

function formatAnalyticsNumber(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}


function renderFleetAnalytics() {
    const summary = document.getElementById("analyticsSummary");
    const insights = document.getElementById("analyticsInsights");

    if (!summary || !insights) {
        console.error("Analytics summary or insights element is missing.");
        return;
    }

    const { trips, vehicles, drivers } = fleetAnalyticsData;

    const completed = trips.filter(
        trip => trip.status === "COMPLETED"
    );

    const pending = trips.filter(trip =>
        ["PENDING_CONFIRMATION", "PENDING"].includes(trip.status)
    );

    const rejected = trips.filter(
        trip => trip.status === "REJECTED"
    );

    const availableVehicles = vehicles.filter(
        vehicle => vehicle.status === "AVAILABLE"
    );

    const activeDrivers = drivers.filter(
        driver => driver.status === "ACTIVE"
    );

    const availableDrivers = drivers.filter(
        driver => driver.availabilityStatus === "AVAILABLE"
    );

    const completedWithDistance = completed.filter(
        trip => trip.actualDistance != null &&
            Number.isFinite(Number(trip.actualDistance))
    );

    const completedWithPrice = completed.filter(
        trip => trip.finalPrice != null &&
            Number.isFinite(Number(trip.finalPrice))
    );

    const totalDistance = completedWithDistance.reduce(
        (sum, trip) => sum + Number(trip.actualDistance),
        0
    );

    const totalCharges = completedWithPrice.reduce(
        (sum, trip) => sum + Number(trip.finalPrice),
        0
    );

    const averageCharge = completedWithPrice.length
        ? totalCharges / completedWithPrice.length
        : 0;

    summary.innerHTML = `
        <div class="stat-card">
            <span class="stat-title">Total Trips</span>
            <strong>${formatAnalyticsNumber(trips.length)}</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Completed Trips</span>
            <strong>${formatAnalyticsNumber(completed.length)}</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Pending Trips</span>
            <strong>${formatAnalyticsNumber(pending.length)}</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Rejected Trips</span>
            <strong>${formatAnalyticsNumber(rejected.length)}</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Total Vehicles</span>
            <strong>${formatAnalyticsNumber(vehicles.length)}</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Available Vehicles</span>
            <strong>${formatAnalyticsNumber(availableVehicles.length)}</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Total Drivers</span>
            <strong>${formatAnalyticsNumber(drivers.length)}</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Active Drivers</span>
            <strong>${formatAnalyticsNumber(activeDrivers.length)}</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Available Drivers</span>
            <strong>${formatAnalyticsNumber(availableDrivers.length)}</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Completed Distance</span>
            <strong>${formatAnalyticsNumber(totalDistance)} KM</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Final Trip Charges</span>
            <strong>${escapeHtml(formatCurrency(totalCharges))}</strong>
        </div>

        <div class="stat-card">
            <span class="stat-title">Average Recorded Trip Charge</span>
            <strong>${escapeHtml(formatCurrency(averageCharge))}</strong>
        </div>
    `;

    insights.innerHTML = `
        <div class="welcome-card">
            <h3>Fleet Overview</h3>
            <p>
                ${formatAnalyticsNumber(completed.length)} of
                ${formatAnalyticsNumber(trips.length)} trips are completed.
            </p>
            <p>
                ${formatAnalyticsNumber(pending.length)} trips are awaiting
                confirmation or remain pending.
            </p>
            <p>
                ${formatAnalyticsNumber(availableVehicles.length)} of
                ${formatAnalyticsNumber(vehicles.length)} vehicles are available.
            </p>
            <p>
                ${formatAnalyticsNumber(activeDrivers.length)} drivers are active,
                and ${formatAnalyticsNumber(availableDrivers.length)}
                are marked available.
            </p>
            <p>
                Distance totals include completed trips with recorded
                odometer distance. Charge totals include completed trips
                with recorded final charges.
            </p>
        </div>
    `;
}


function renderFleetAIAnswer(text) {
    // Escape HTML before formatting AI-generated content.
    const escape = value => String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

    const lines = escape(text).split(/\r?\n/);
    let html = "";
    let inList = false;

    const closeList = () => {
        if (inList) {
            html += "</ul>";
            inList = false;
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) {
            closeList();
            continue;
        }

        // Support Markdown bold.
        const formatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

        // Render headings.
        if (/^#{1,3}\s/.test(line)) {
            closeList();
            html += `<h3>${formatted.replace(/^#{1,3}\s/, "")}</h3>`;
            continue;
        }

        // Render bullet points.
        if (/^[-*•]\s/.test(line)) {
            if (!inList) {
                html += '<ul class="fleet-ai-list">';
                inList = true;
            }

            html += `<li>${formatted.replace(/^[-*•]\s/, "")}</li>`;
            continue;
        }

        closeList();

        // Render Markdown table rows as readable rows.
        if (line.startsWith("|") && line.endsWith("|")) {
            const cells = line.slice(1, -1).split("|").map(cell => cell.trim());

            if (cells.every(cell => /^:?-{3,}:?$/.test(cell))) {
                continue;
            }

            html += `<div class="fleet-ai-table-row">${
                cells.map(cell => `<span>${cell}</span>`).join("")
            }</div>`;
            continue;
        }

        html += `<p>${formatted}</p>`;
    }

    closeList();
    return `<div class="fleet-ai-response">${html}</div>`;
}



/* =========================================================
   FLEET TRACKING MAP
   Displays recorded trip coordinates.
   Admin-only; uses the existing authenticated API helper.
   ========================================================= */

let fleetTrackingMap = null;
let fleetTrackingLayer = null;

function initializeFleetTrackingMap() {
    const mapElement = document.getElementById("fleetTrackingMap");

    if (!mapElement) {
        throw new Error("Fleet tracking map container is missing from index.html.");
    }

    if (typeof L === "undefined") {
        throw new Error(
            "Leaflet did not load. Check the Leaflet CSS and JS script tags in index.html."
        );
    }

    if (!fleetTrackingMap) {
        fleetTrackingMap = L.map("fleetTrackingMap").setView(
            [20.5937, 78.9629],
            5
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(fleetTrackingMap);

        fleetTrackingLayer = L.featureGroup().addTo(fleetTrackingMap);
    }

    // The page may have been hidden when the map was initialized.
    setTimeout(() => {
        if (fleetTrackingMap) {
            fleetTrackingMap.invalidateSize();
        }
    }, 100);
}

function isValidCoordinate(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);

    return latitude !== null &&
        latitude !== undefined &&
        longitude !== null &&
        longitude !== undefined &&
        String(latitude).trim() !== "" &&
        String(longitude).trim() !== "" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180;
}

function getTrackingVehicleName(trip, vehicles) {
    const vehicle = vehicles.find(
        item => item.ID === trip.vehicle_ID
    ) || trip.vehicle || {};

    const name = [
        vehicle.brand || "",
        vehicle.model || ""
    ].join(" ").trim();

    return name || vehicle.registrationNumber || "Vehicle details unavailable";
}

function renderFleetTracking(trips, vehicles) {
    initializeFleetTrackingMap();

    fleetTrackingLayer.clearLayers();

    const routeTrips = trips.filter(trip =>
        isValidCoordinate(trip.startLatitude, trip.startLongitude) &&
        isValidCoordinate(trip.endLatitude, trip.endLongitude)
    );

    const summary = document.getElementById("fleetTrackingSummary");
    const list = document.getElementById("fleetTrackingList");
    const message = document.getElementById("fleetTrackingMessage");

    const uniqueVehicles = new Set(
        trips.map(trip => trip.vehicle_ID).filter(Boolean)
    );

    summary.innerHTML = `
        <div class="stat-card">
            <span class="stat-title">Total Vehicles</span>
            <strong>${uniqueVehicles.size}</strong>
        </div>
        <div class="stat-card">
            <span class="stat-title">Trips with Coordinates</span>
            <strong>${routeTrips.length}</strong>
        </div>
        <div class="stat-card">
            <span class="stat-title">Recorded Routes</span>
            <strong>${routeTrips.length}</strong>
        </div>
    `;

    if (routeTrips.length === 0) {
        message.textContent =
            "No trips currently contain valid start and destination coordinates.";

        list.innerHTML = `
            <p>
                Add valid startLatitude, startLongitude, endLatitude and
                endLongitude values to a trip to display its route.
            </p>
        `;
        fleetTrackingMap.setView([20.5937, 78.9629], 5);
        return;
    }

    const allCoordinates = [];

    routeTrips.forEach(trip => {
        const start = [
            Number(trip.startLatitude),
            Number(trip.startLongitude)
        ];

        const end = [
            Number(trip.endLatitude),
            Number(trip.endLongitude)
        ];

        const vehicleName = getTrackingVehicleName(trip, vehicles);
        const status = trip.status || "UNKNOWN";

        const routeLine = L.polyline([start, end], {
            color: status === "IN_PROGRESS" ? "#16a34a" : "#2563eb",
            weight: 4,
            opacity: 0.8
        }).addTo(fleetTrackingLayer);

        routeLine.bindPopup(`
            <strong>${escapeHtml(vehicleName)}</strong><br>
            Trip status: ${escapeHtml(status.replace(/_/g, " "))}<br>
            From: ${escapeHtml(trip.startLocation || "-")}<br>
            To: ${escapeHtml(trip.endLocation || "-")}
        `);

        L.marker(start).addTo(fleetTrackingLayer)
            .bindPopup(`
                <strong>Start</strong><br>
                ${escapeHtml(trip.startLocation || "-")}<br>
                ${escapeHtml(vehicleName)}
            `);

        L.marker(end).addTo(fleetTrackingLayer)
            .bindPopup(`
                <strong>Destination</strong><br>
                ${escapeHtml(trip.endLocation || "-")}<br>
                ${escapeHtml(vehicleName)}
            `);

        allCoordinates.push(start, end);
    });

    fleetTrackingMap.fitBounds(allCoordinates, {
        padding: [30, 30],
        maxZoom: 12
    });

    message.textContent =
        `Showing ${routeTrips.length} recorded route(s). ` +
        "These are trip coordinates, not live GPS positions.";

    list.innerHTML = routeTrips.map(trip => `
        <div class="vehicle-card">
            <h3>
                ${escapeHtml(trip.startLocation || "-")}
                &rarr;
                ${escapeHtml(trip.endLocation || "-")}
            </h3>
            <p><strong>Vehicle:</strong>
                ${escapeHtml(getTrackingVehicleName(trip, vehicles))}
            </p>
            <p><strong>Trip date:</strong>
                ${escapeHtml(trip.tripDate || "-")}
            </p>
            <p><strong>Status:</strong>
                ${escapeHtml((trip.status || "UNKNOWN").replace(/_/g, " "))}
            </p>
        </div>
    `).join("");
}

async function loadFleetTracking() {
    const message = document.getElementById("fleetTrackingMessage");
    const summary = document.getElementById("fleetTrackingSummary");
    const list = document.getElementById("fleetTrackingList");

    if (!message || !summary || !list) {
        console.error("Fleet tracking HTML elements are missing.");
        return;
    }

    if (!currentUser || currentUser.role !== "ADMIN") {
        message.textContent =
            "Administrator access is required to view fleet tracking.";
        return;
    }

    message.textContent = "Loading fleet tracking data...";
    list.innerHTML = "<p>Loading trip locations...</p>";

    try {
        const [tripResponse, vehicleResponse] = await Promise.all([
            apiRequest(`${API_BASE}/admin/Trips?$top=5000`),
            apiRequest(`${API_BASE}/admin/Vehicles?$top=5000`)
        ]);

        const trips = tripResponse?.value || [];
        const vehicles = vehicleResponse?.value || [];

        renderFleetTracking(trips, vehicles);
    } catch (error) {
        console.error("Fleet tracking failed:", error);

        message.textContent =
            `Unable to load fleet tracking: ${error.message}`;

        summary.innerHTML = "";
        list.innerHTML = "<p>Could not load trip locations. Please try again.</p>";
    }
}

/* =========================================================
   TRIP LOCATION SEARCH
   ========================================================= */

let selectedTripStartLocation = null;
let selectedTripEndLocation = null;

const locationSearchTimers = {};

function showLocationMessage(list, message) {
    list.innerHTML = "";

    const item = document.createElement("div");
    item.className = "location-suggestion-message";
    item.textContent = message;

    list.appendChild(item);
    list.classList.remove("hidden");
}

function setupTripLocationSearch(inputId, listId, selectedId, type) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    const selectedLabel = document.getElementById(selectedId);

    if (!input || !list || !selectedLabel) {
        console.error("Location search elements not found:", inputId);
        return;
    }

    input.addEventListener("input", function () {
        const query = input.value.trim();

        // Clear any previously selected coordinates.
        if (type === "start") {
            selectedTripStartLocation = null;
        } else {
            selectedTripEndLocation = null;
        }

        selectedLabel.textContent =
            "Select a location from the search results.";
        selectedLabel.classList.remove("is-selected");

        clearTimeout(locationSearchTimers[type]);
        list.classList.add("hidden");

        if (query.length < 3) {
            return;
        }

        locationSearchTimers[type] = setTimeout(async function () {
            showLocationMessage(list, "Searching locations...");

            try {
                const url =
                    "https://nominatim.openstreetmap.org/search" +
                    "?format=jsonv2&limit=5&countrycodes=in&q=" +
                    encodeURIComponent(query);

                const response = await fetch(url, {
                    headers: {
                        "Accept": "application/json"
                    }
                });

                if (!response.ok) {
                    throw new Error("Location service unavailable.");
                }

                const places = await response.json();

                // Ignore results if the input has changed.
                if (input.value.trim() !== query) {
                    return;
                }

                list.innerHTML = "";

                if (!places.length) {
                    showLocationMessage(list, "No matching places found.");
                    return;
                }

                places.forEach(function (place) {
                    const item = document.createElement("button");

                    item.type = "button";
                    item.className = "location-suggestion-item";
                    item.setAttribute("role", "option");
                    item.textContent = place.display_name;

                    item.addEventListener("click", function () {
                        const chosenPlace = {
                            name: place.display_name,
                            latitude: Number(place.lat),
                            longitude: Number(place.lon)
                        };

                        input.value = place.display_name;

                        if (type === "start") {
                            selectedTripStartLocation = chosenPlace;
                        } else {
                            selectedTripEndLocation = chosenPlace;
                        }

                        selectedLabel.textContent =
                            "✓ Location selected";
                        selectedLabel.classList.add("is-selected");

                        list.classList.add("hidden");
                        list.innerHTML = "";
                    });

                    list.appendChild(item);
                });

                list.classList.remove("hidden");

            } catch (error) {
                console.error("Location search failed:", error);
                showLocationMessage(
                    list,
                    "Could not load locations. Please try again."
                );
            }
        }, 1000);
    });

    input.addEventListener("focus", function () {
        if (input.value.trim().length >= 3 &&
            !selectedLocationForType(type)) {
            input.dispatchEvent(new Event("input"));
        }
    });

    input.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            list.classList.add("hidden");
        }
    });

    document.addEventListener("click", function (event) {
        if (!event.target.closest(".location-search-group")) {
            list.classList.add("hidden");
        }
    });
}

function selectedLocationForType(type) {
    return type === "start"
        ? selectedTripStartLocation
        : selectedTripEndLocation;
}

function initializeTripLocationSearch() {
    setupTripLocationSearch(
        "tripStartLocation",
        "tripStartSuggestions",
        "tripStartSelected",
        "start"
    );

    setupTripLocationSearch(
        "tripEndLocation",
        "tripEndSuggestions",
        "tripEndSelected",
        "end"
    );
}

document.addEventListener(
    "DOMContentLoaded",
    initializeTripLocationSearch
);
/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    restoreSession();

    // If no valid session was restored, show the public landing page
    if (!currentUser) {
        showLandingPage();
    }
});