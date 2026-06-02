import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useAppDispatch } from "../../store/hooks";
import { setCurrentUser } from "../../store/authSlice";
import { api, ApiError } from "../../api/client";
import logo from "../../assets/leterago-logo.png";

const EMAIL_DOMAIN = "@leterago.com.do";

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [step, setStep] = useState<"details" | "code">("details");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !normalizedEmail || !password) return;
    if (!normalizedEmail.endsWith(EMAIL_DOMAIN)) {
      setError(`El correo debe terminar en ${EMAIL_DOMAIN}`);
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const res = await api.registerStart({ name: name.trim(), email: normalizedEmail, password });
      setStep("code");
      setInfo(
        res.emailSent
          ? `Enviamos un código de confirmación a ${normalizedEmail}.`
          : "SMTP deshabilitado: revisa la consola del servidor para obtener el código.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("El código debe tener 6 dígitos");
      return;
    }

    setLoading(true);
    try {
      const user = await api.registerVerify({ email: normalizedEmail, code });
      dispatch(setCurrentUser(user));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo + título */}
        <div className="text-center mb-8">
          <img src={logo} alt="Logo Leterago" className="w-40 h-auto mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Mesa de Servicio</h1>
          <p className="text-sm text-gray-400 mt-1">Leterago Dominicana</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-6">
            {step === "details" ? "Crear cuenta" : "Confirmar correo"}
          </h2>

          {info && (
            <p className="text-xs text-blue-700 font-medium bg-blue-50 border border-blue-200 rounded-md px-3 py-2 mb-4">
              {info}
            </p>
          )}

          {step === "details" ? (
            <form onSubmit={handleStart} className="flex flex-col gap-4">
              {/* Nombre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(null); }}
                  placeholder="Tu nombre"
                  autoComplete="name"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder={`usuario${EMAIL_DOMAIN}`}
                  autoComplete="email"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Contraseña */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirmar contraseña */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Confirmar contraseña
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0047AC] text-white py-2.5 rounded-md font-semibold text-sm hover:bg-blue-700 transition-colors mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Enviando código..." : "Continuar"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              {/* Código */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Código de confirmación
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.4em] outline-none focus:border-[#0047AC] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-[#0047AC] text-white py-2.5 rounded-md font-semibold text-sm hover:bg-blue-700 transition-colors mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Verificando..." : "Crear cuenta"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("details"); setError(null); setInfo(null); setCode(""); }}
                className="text-xs text-gray-500 font-semibold hover:text-gray-700 flex items-center justify-center gap-1"
              >
                <ArrowLeft size={13} /> Cambiar datos
              </button>
            </form>
          )}
        </div>

        {/* Volver a login */}
        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-[#0047AC] font-semibold hover:underline"
          >
            Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
}
