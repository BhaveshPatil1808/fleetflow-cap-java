@path: '/auth'
service AuthService {
    action login(
        username : String,
        password : String
    ) returns AuthInfo;

    action register(
        firstName     : String(50),
        lastName      : String(50),
        email         : String(100),
        password      : String,
        role          : String(20),
        phone         : String(20),
        licenseNumber : String(30),
        licenseExpiry : Date
    ) returns AuthInfo;

    type AuthInfo {
        username : String;
        role     : String;
    }
}