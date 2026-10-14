
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
        "requestsNav",
        "tripHistoryNav",
        "billingNav"
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
        // Fetch existing records only. No database changes are made.
        const trips = await getCurrentUserTrips();
        const trip = trips.find(item => item.ID === tripID);

        if (!trip || trip.status !== "COMPLETED") {
            throw new Error("A completed trip is required to generate an invoice.");
        }

        const invoiceResponse = await apiRequest(
            `${API_BASE}/payment/Invoices`
        );

        const invoices = invoiceResponse?.value || [];
        const invoice = invoices.find(item => item.trip_ID === tripID);

        const customerName = [
            currentUser?.firstName,
            currentUser?.lastName
        ].filter(Boolean).join(" ") ||
            currentUser?.email ||
            "FleetFlow Customer";

        const invoiceNumber = invoice?.invoiceNumber || `FF-${trip.ID}`;
        const paymentStatus = String(invoice?.status || "UNPAID").toUpperCase();

        const actualDistance = Number(trip.actualDistance) || 0;
        const rate = Number(trip.ratePerKM) || 0;
        const calculatedCharge = actualDistance * rate;

        // Prefer the persisted invoice amount, then the completed trip charge.
        const finalAmount = Number(
            invoice?.amount ?? trip.finalPrice ?? calculatedCharge
        );

        const vehicle = trip.vehicle
            ? [
                trip.vehicle.brand,
                trip.vehicle.model,
                trip.vehicle.registrationNumber
            ].filter(Boolean).join(" ")
            : "Not specified";

        const registrationNumber =
            trip.vehicle?.registrationNumber || "Not specified";

        const formatCurrency = amount =>
            "INR " + Number(amount || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

        const formatDate = value => {
            if (!value) return "N/A";

            // Avoid timezone shifts for date-only values such as YYYY-MM-DD.
            const raw = String(value);
            const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
                ? new Date(raw + "T00:00:00")
                : new Date(raw);

            return Number.isNaN(date.getTime())
                ? raw
                : date.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                });
        };

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("p", "mm", "a4");

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 14;
        const contentWidth = pageWidth - margin * 2;
        let y = 0;

        // FleetFlow brand palette.
        const navy = [22, 42, 75];
        const blue = [37, 99, 235];
        const lightBlue = [239, 246, 255];
        const lightGray = [245, 247, 250];
        const gray = [91, 100, 115];
        const dark = [35, 43, 55];
        const green = [22, 128, 75];
        const red = [185, 45, 45];
        const border = [220, 226, 234];

        const setText = (color = dark) => pdf.setTextColor(...color);

        const drawSectionTitle = title => {
            pdf.setFillColor(...lightBlue);
            pdf.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, "F");
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9);
            setText(navy);
            pdf.text(title.toUpperCase(), margin + 3, y + 5.3);
            y += 13;
        };

        const drawLabelValue = (label, value, x, valueX, maxWidth = 60) => {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8.5);
            setText(gray);
            pdf.text(label, x, y);

            pdf.setFont("helvetica", "bold");
            setText(dark);

            const lines = pdf.splitTextToSize(
                String(value ?? "N/A"),
                maxWidth
            );
            pdf.text(lines, valueX, y);
            return Math.max(5, lines.length * 4.2);
        };

        const ensureSpace = needed => {
            if (y + needed > pageHeight - 17) {
                pdf.addPage();
                y = 18;
            }
        };

        const safeText = value => String(value ?? "N/A");

        // ---------- HEADER ----------
        pdf.setFillColor(...navy);
        pdf.rect(0, 0, pageWidth, 38, "F");

        pdf.setFillColor(...blue);
        pdf.rect(0, 35, pageWidth, 3, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(23);
        pdf.setTextColor(255, 255, 255);
        pdf.text("FLEETFLOW", margin, 17);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(220, 230, 245);
        pdf.text("FLEET & VEHICLE MANAGEMENT SYSTEM", margin, 24);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.setTextColor(255, 255, 255);
        pdf.text("TRIP INVOICE", pageWidth - margin, 17, {
            align: "right"
        });

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(220, 230, 245);
        pdf.text("OFFICIAL BILLING DOCUMENT", pageWidth - margin, 24, {
            align: "right"
        });

        // ---------- INVOICE SUMMARY ----------
        y = 47;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        setText(gray);
        pdf.text("INVOICE NUMBER", margin, y);
        pdf.text("INVOICE DATE", pageWidth / 2 + 5, y);

        y += 6;
        pdf.setFontSize(11);
        setText(navy);
        pdf.text(invoiceNumber, margin, y);
        pdf.text(formatDate(new Date()), pageWidth / 2 + 5, y);

        y += 8;
        pdf.setDrawColor(...border);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 9;

        // ---------- CUSTOMER DETAILS ----------
        drawSectionTitle("Bill To");

        const leftX = margin + 1;
        const rightX = pageWidth / 2 + 5;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        setText(dark);
        pdf.text(customerName, leftX, y);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        setText(gray);
        pdf.text(safeText(currentUser?.email || "N/A"), leftX, y + 6);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        setText(gray);
        pdf.text("DOCUMENT TYPE", rightX, y - 1);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        setText(dark);
        pdf.text("Completed Trip Invoice", rightX, y + 5);

        y += 17;

        // ---------- TRIP DETAILS ----------
        drawSectionTitle("Trip Details");

        const col1 = margin + 2;
        const col2 = pageWidth / 2 + 4;
        const valueOffset = 29;
        const valueOffset2 = 29;
        const valueWidth = 47;

        const tripRows = [
            [
                ["Trip ID", trip.ID],
                ["Trip Date", formatDate(trip.tripDate)]
            ],
            [
                ["Pickup", trip.startLocation || "N/A"],
                ["Destination", trip.endLocation || "N/A"]
            ],
            [
                ["Vehicle", vehicle],
                ["Registration", registrationNumber]
            ],
            [
                ["Starting Odometer", trip.startMeter ?? "N/A"],
                ["Ending Odometer", trip.endMeter ?? "N/A"]
            ],
            [
                ["Actual Distance", `${actualDistance.toLocaleString("en-IN")} km`],
                ["Rate per KM", formatCurrency(rate)]
            ]
        ];

        for (const row of tripRows) {
            ensureSpace(11);

            const firstHeight = drawLabelValue(
                row[0][0],
                row[0][1],
                col1,
                col1 + valueOffset,
                valueWidth
            );

            const secondHeight = drawLabelValue(
                row[1][0],
                row[1][1],
                col2,
                col2 + valueOffset2,
                valueWidth
            );

            y += Math.max(firstHeight, secondHeight) + 3;
        }

        y += 2;

        // ---------- BILLING BREAKDOWN ----------
        drawSectionTitle("Billing Breakdown");

        const tableX = margin;
        const tableW = contentWidth;
        const labelX = tableX + 4;
        const amountX = tableX + tableW - 4;

        pdf.setFillColor(...lightGray);
        pdf.roundedRect(tableX, y - 2, tableW, 9, 1, 1, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        setText(navy);
        pdf.text("DESCRIPTION", labelX, y + 3.5);
        pdf.text("AMOUNT", amountX, y + 3.5, { align: "right" });

        y += 12;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        setText(dark);
        pdf.text(
            `Trip distance charge (${actualDistance} km x ${formatCurrency(rate)}/km)`,
            labelX,
            y
        );
        pdf.text(formatCurrency(calculatedCharge), amountX, y, {
            align: "right"
        });

        y += 5;
        pdf.setDrawColor(...border);
        pdf.line(tableX, y, tableX + tableW, y);

        y += 8;

        // The stored invoice/trip total remains authoritative.
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        setText(gray);
        pdf.text("Subtotal", amountX - 52, y);
        pdf.text(formatCurrency(calculatedCharge), amountX, y, {
            align: "right"
        });

        y += 7;
        pdf.text("Adjustments", amountX - 52, y);
        pdf.text(
            formatCurrency(finalAmount - calculatedCharge),
            amountX,
            y,
            { align: "right" }
        );

        y += 3;
        pdf.setDrawColor(...border);
        pdf.line(amountX - 57, y, amountX, y);

        y += 9;
        pdf.setFillColor(...navy);
        pdf.roundedRect(tableX, y - 5, tableW, 17, 2, 2, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text("TOTAL AMOUNT", tableX + 4, y + 1.5);

        pdf.setFontSize(13);
        pdf.text(formatCurrency(finalAmount), amountX - 4, y + 1.5, {
            align: "right"
        });

        y += 20;

        // ---------- PAYMENT STATUS ----------
        drawSectionTitle("Payment Information");

        const isPaid = paymentStatus === "PAID";

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        setText(gray);
        pdf.text("Payment Status", margin + 2, y + 1);

        const badgeText = paymentStatus.replace(/_/g, " ");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);

        const badgeWidth = pdf.getTextWidth(badgeText) + 10;
        pdf.setFillColor(
            ...(isPaid ? [225, 247, 235] : [255, 242, 220])
        );
        pdf.roundedRect(margin + 39, y - 4, badgeWidth, 8, 2, 2, "F");

        setText(isPaid ? green : red);
        pdf.text(badgeText, margin + 44, y + 1);

        y += 11;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        setText(gray);
        pdf.text(
            isPaid
                ? "Payment is recorded as paid in FleetFlow."
                : "Payment is not marked as paid in FleetFlow.",
            margin + 2,
            y
        );

        y += 14;

        // ---------- SIGNATURES ----------
        ensureSpace(32);
        drawSectionTitle("Acknowledgement & Authorization");

        const signatureGap = 15;
        const signatureWidth = (contentWidth - signatureGap) / 2;
        const signatureY = y + 13;

        pdf.setDrawColor(...gray);
        pdf.line(
            margin + 2,
            signatureY,
            margin + 2 + signatureWidth - 5,
            signatureY
        );

        pdf.line(
            margin + signatureWidth + signatureGap,
            signatureY,
            pageWidth - margin - 2,
            signatureY
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        setText(dark);
        pdf.text("Customer Acknowledgement", margin + 2, signatureY + 5);
        pdf.text(
            "Authorized Signature",
            margin + signatureWidth + signatureGap,
            signatureY + 5
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        setText(gray);
        pdf.text("Name / Date", margin + 2, signatureY + 10);
        pdf.text("FleetFlow Representative / Date",
            margin + signatureWidth + signatureGap,
            signatureY + 10
        );

        // ---------- FOOTER ----------
        const footerY = pageHeight - 12;

        pdf.setDrawColor(...border);
        pdf.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        setText(gray);
        pdf.text(
            "FleetFlow | Fleet & Vehicle Management System",
            margin,
            footerY
        );
        pdf.text(
            "Generated electronically",
            pageWidth - margin,
            footerY,
            { align: "right" }
        );

        const safeName = String(invoiceNumber)
            .replace(/[^a-zA-Z0-9_-]/g, "_");

        pdf.save(`${safeName}.pdf`);

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
   START APPLICATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    restoreSession();
});