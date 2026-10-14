
const API_BASE = "/odata/v4";

let currentUser = null;
let selectedVehicleID = null;

let odometerTripID = null;
let odometerMode = null;

/* =========================================================
   AUTHENTICATION
   ========================================================= */

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
    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("appPage").classList.remove("hidden");

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
        "requestsNav"
    ];

    navigationIds.forEach(id => {
        document.getElementById(id).classList.add("hidden");
    });

    if (currentUser.role === "DRIVER") {
        document.getElementById("vehiclesNav").classList.remove("hidden");
        document.getElementById("requestsNav").classList.remove("hidden");
    }

    if (currentUser.role === "USER") {
        document.getElementById("availableCarsNav").classList.remove("hidden");
        document.getElementById("tripsNav").classList.remove("hidden");
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
   START APPLICATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    restoreSession();
});