# World ID Selfie Check Feedback

1. **Selfie Check TestFlight:** The documentation led us to believe that the
   TestFlight/Sandbox app was required, but the beta was not accepting new
   testers. We later learned that Selfie Check already works in the official
   World App, so this should be stated more clearly.

2. **Staging environment variable:** As new users, it was confusing that
   `staging` is only for the simulator while the official World App requires
   `production`. Using the World App with `staging` resulted in an
   `invalid_merkle_root` error. A more visible warning would help.

3. **Simulator:** The simulator does not currently offer a Selfie Check/Face
   option. It would be helpful to either support it or clearly mention this
   limitation in the Selfie Check documentation.

4. **identity:** The avaibles countries should be visible in the docs for now
   they are only in the World App
