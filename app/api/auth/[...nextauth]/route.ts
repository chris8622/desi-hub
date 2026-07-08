import { handlers } from "@/auth";

// Auth.js-Endpunkte unter /api/auth/* (session, callback, signin, signout, csrf).
// Koexistiert mit der alten /api/auth-Route (exakter Pfad, andere Tiefe) während
// des Übergangs — die wird im Cutover-Increment abgelöst.
export const { GET, POST } = handlers;
