import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Database,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Wifi,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  PageShell,
  Select,
  Switch,
  Textarea,
  useDialog,
} from "../components/ui";
import { ApiError } from "../services/api";
import {
  configuracionService,
  type AiPromptStatus,
  type EmailSignatureStatus,
  type LocalStatus,
  type SmtpPayload,
  type SmtpStatus,
} from "../services/configuracionService";
import { sanitizeHtml } from "../utils/sanitizeHtml";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

type SignatureFields = {
  nombre: string;
  empresa: string;
  direccion: string;
  telefono: string;
  email: string;
};

const EMPTY_SIGNATURE_FIELDS: SignatureFields = {
  nombre: "",
  empresa: "Grupo Publicitario Cruzial",
  direccion: "Bº La Yesera, 51 - nave 1. 39.612 Parbayón CANTABRIA",
  telefono: "942 03 34 04",
  email: "admin@cruzialpublicidad.com",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildSignatureHtml(fields: SignatureFields) {
  const nombre = fields.nombre.trim() || "{{nombre_remitente}}";
  const empresa = fields.empresa.trim();
  const direccion = fields.direccion.trim();
  const telefono = fields.telefono.trim();
  const email = fields.email.trim();

  return `<br>
<p>
    Agradeciéndoles de antemano su atención.<br>
    Quedo a su entera disposición para cualquier duda.<br>
    Un cordial saludo,
</p>
<p>
    <b>${escapeHtml(nombre)}</b>${empresa ? `<br>\n    ${escapeHtml(empresa)}` : ""}
</p>
<img src="cid:firmaLogo" style="width: 200px; margin-top: 10px; margin-bottom: 10px;" alt="Logo Cruzial">
<p style="font-size: 11px; color: #777777;">
    <b>GRUPO PUBLICITARIO CRUZIAL, S.L.</b> CIF: B-39.378.146.${direccion ? `<br>\n    ${escapeHtml(direccion)}` : ""}${telefono || email ? `<br>\n    ${telefono ? `Tlfs: ${escapeHtml(telefono)}` : ""}${telefono && email ? ". " : ""}${email ? `email: ${escapeHtml(email)}` : ""}` : ""}
</p>`;
}

function textFromHtml(html: string) {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, "").trim();
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent || "").trim();
}

function signatureFieldsFromHtml(html: string): SignatureFields {
  const result = { ...EMPTY_SIGNATURE_FIELDS };
  if (!html.trim() || typeof document === "undefined") return result;

  const root = document.createElement("div");
  root.innerHTML = html;
  const paragraphs = Array.from(root.querySelectorAll("p"));
  const identity = paragraphs.find((p) => {
    const bold = p.querySelector("b");
    return Boolean(bold && !/GRUPO PUBLICITARIO CRUZIAL, S\.L\./i.test(bold.textContent || ""));
  });

  if (identity) {
    const bold = identity.querySelector("b");
    if (bold?.textContent?.trim()) {
      const parsedName = bold.textContent.trim();
      result.nombre = parsedName === "{{nombre_remitente}}" ? "" : parsedName;
    }
    const clone = identity.cloneNode(true) as HTMLElement;
    clone.querySelector("b")?.remove();
    const company = textFromHtml(clone.innerHTML.replace(/<br\s*\/?>(\s*)/gi, " "));
    if (company) result.empresa = company;
  }

  const legal = paragraphs.find((p) => /CIF:/i.test(p.textContent || ""));
  if (legal) {
    const lines = legal.innerHTML
      .split(/<br\s*\/?>(?:\s*)/i)
      .map(textFromHtml)
      .filter(Boolean);
    if (lines[1]) result.direccion = lines[1];
    const contact = lines.find((line) => /Tlfs?:|email:/i.test(line));
    if (contact) {
      const phone = contact.match(/Tlfs?:\s*([^.]*(?:\.[^e]*)?)(?=\.\s*email:|\s+email:|$)/i);
      const email = contact.match(/email:\s*([^\s]+)/i);
      if (phone?.[1]?.trim()) result.telefono = phone[1].trim().replace(/\.$/, "");
      if (email?.[1]?.trim()) result.email = email[1].trim();
    }
  }

  return result;
}

export default function AjustesPage() {
  const { alert, confirm } = useDialog();
  const [localStatus, setLocalStatus] = useState<LocalStatus | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);
  const [aiPromptStatus, setAiPromptStatus] = useState<AiPromptStatus | null>(null);
  const [signatureStatus, setSignatureStatus] = useState<EmailSignatureStatus | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [emailSignature, setEmailSignature] = useState("");
  const [signatureFields, setSignatureFields] = useState<SignatureFields>(EMPTY_SIGNATURE_FIELDS);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [savingAiPrompt, setSavingAiPrompt] = useState(false);
  const [resettingAiPrompt, setResettingAiPrompt] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [resettingSignature, setResettingSignature] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [fromName, setFromName] = useState("Cruzial");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpSecurity, setSmtpSecurity] = useState("ssl");
  const [autoDiscover, setAutoDiscover] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [local, smtp, promptIa, firma] = await Promise.all([
        configuracionService.estado(),
        configuracionService.smtpEstado(),
        configuracionService.promptIa(),
        configuracionService.firmaEmail(),
      ]);
      setLocalStatus(local);
      setSmtpStatus(smtp);
      setAiPromptStatus(promptIa);
      setAiPrompt(promptIa.prompt);
      setSignatureStatus(firma);
      setEmailSignature(firma.signature_html);
      setSignatureFields(signatureFieldsFromHtml(firma.signature_html));
      setSmtpUsername(smtp.smtp_username || "");
      setFromName(smtp.from_name || "Cruzial");
      setFromEmail(smtp.from_email || "");
      setReplyTo(smtp.reply_to || "");
      setSmtpHost(smtp.smtp_host || "");
      setSmtpPort(String(smtp.smtp_port || 465));
      setSmtpSecurity(smtp.smtp_security || "ssl");
      setAutoDiscover(!smtp.smtp_host);
      setSmtpPassword("");
      setShowSmtpPassword(false);
      window.dispatchEvent(new Event("cruzial:smtp-updated"));
    } catch (error) {
      await alert({
        title: "No se pudo cargar la configuración",
        description: errorMessage(error, "Comprueba que el backend está iniciado."),
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const payload = useMemo<SmtpPayload>(() => ({
    smtp_username: smtpUsername.trim(),
    smtp_password: smtpPassword,
    from_name: fromName.trim() || undefined,
    from_email: fromEmail.trim() || undefined,
    reply_to: replyTo.trim() || undefined,
    smtp_host: smtpHost.trim() || undefined,
    smtp_port: Number(smtpPort) || undefined,
    smtp_security: smtpSecurity,
    auto_discover: autoDiscover,
  }), [smtpUsername, smtpPassword, fromName, fromEmail, replyTo, smtpHost, smtpPort, smtpSecurity, autoDiscover]);

  const signaturePreviewHtml = useMemo(() => {
    if (!emailSignature.trim()) return "";
    const apiOrigin =
      typeof window !== "undefined" && window.location.port !== "5173"
        ? window.location.origin
        : "http://127.0.0.1:8000";

    return emailSignature
      .replace(/\{\{nombre_remitente\}\}/g, signatureFields.nombre.trim() || fromName.trim() || "Nombre remitente")
      .replace(
        /<img([^>]*?)src=["']cid:firmaLogo["']([^>]*)>/gi,
        `<img$1src="${apiOrigin}/api/campanas/logo-firma" width="200"$2>`,
      )
      .replace(/cid:firmaLogo/g, `${apiOrigin}/api/campanas/logo-firma`);
  }, [emailSignature, signatureFields.nombre, fromName]);

  const updateSignatureField = (key: keyof SignatureFields, value: string) => {
    setSignatureFields((current) => {
      const next = { ...current, [key]: value };
      setEmailSignature(buildSignatureHtml(next));
      return next;
    });
  };

  const validate = async () => {
    if (!smtpUsername.trim()) {
      await alert({
        title: "Falta el usuario SMTP",
        description: "Introduce el usuario o email de la cuenta SMTP.",
        tone: "warning",
      });
      return false;
    }
    if (!smtpPassword && !smtpStatus?.configured) {
      await alert({
        title: "Falta la contraseña SMTP",
        description: "Introduce la contraseña para configurar la cuenta por primera vez.",
        tone: "warning",
      });
      return false;
    }
    if (!autoDiscover && !smtpHost.trim()) {
      await alert({
        title: "Falta el servidor SMTP",
        description: "Indica el host o activa la detección automática.",
        tone: "warning",
      });
      return false;
    }
    return true;
  };

  const handleTest = async () => {
    if (!(await validate())) return;
    setTesting(true);
    try {
      const result = await configuracionService.smtpProbar(payload);
      await alert({
        title: result.ok ? "SMTP correcto" : "Prueba SMTP fallida",
        description: result.ok
          ? `${result.message} ${result.smtp_host || ""}:${result.smtp_port || ""}`
          : result.message,
        tone: result.ok ? "success" : "danger",
      });
    } catch (error) {
      await alert({ title: "Prueba SMTP fallida", description: errorMessage(error, "No se pudo conectar."), tone: "danger" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!(await validate())) return;
    setSaving(true);
    try {
      const saved = await configuracionService.smtpGuardar(payload);
      setSmtpStatus(saved);
      setSmtpPassword("");
      setShowSmtpPassword(false);
      window.dispatchEvent(new Event("cruzial:smtp-updated"));
      await alert({
        title: "SMTP guardado",
        description: "La contraseña se ha guardado cifrada y la conexión ha sido validada.",
        tone: "success",
      });
    } catch (error) {
      await alert({ title: "No se pudo guardar", description: errorMessage(error, "La configuración SMTP no es válida."), tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAiPrompt = async () => {
    const clean = aiPrompt.trim();
    if (!clean) {
      await alert({
        title: "Prompt vacío",
        description: "Escribe unas instrucciones base antes de guardarlo.",
        tone: "warning",
      });
      return;
    }

    setSavingAiPrompt(true);
    try {
      const saved = await configuracionService.promptIaGuardar(clean);
      setAiPromptStatus(saved);
      setAiPrompt(saved.prompt);
      await alert({
        title: "Prompt guardado",
        description: "Se usará la próxima vez que copies el contexto desde Campañas email.",
        tone: "success",
      });
    } catch (error) {
      await alert({
        title: "No se pudo guardar el prompt",
        description: errorMessage(error, "Error guardando la configuración."),
        tone: "danger",
      });
    } finally {
      setSavingAiPrompt(false);
    }
  };

  const handleResetAiPrompt = async () => {
    const ok = await confirm({
      title: "Restaurar prompt predeterminado",
      description: "Se sustituirán tus instrucciones actuales por el prompt base de Cruzial.",
      confirmLabel: "Restaurar",
      tone: "warning",
    });
    if (!ok) return;

    setResettingAiPrompt(true);
    try {
      const restored = await configuracionService.promptIaRestaurar();
      setAiPromptStatus(restored);
      setAiPrompt(restored.prompt);
    } catch (error) {
      await alert({
        title: "No se pudo restaurar",
        description: errorMessage(error, "Error restaurando el prompt."),
        tone: "danger",
      });
    } finally {
      setResettingAiPrompt(false);
    }
  };

  const handleSaveSignature = async () => {
    setSavingSignature(true);
    try {
      const saved = await configuracionService.firmaEmailGuardar(emailSignature);
      setSignatureStatus(saved);
      setEmailSignature(saved.signature_html);
      await alert({
        title: "Firma guardada",
        description: "La nueva firma se añadirá a los próximos correos enviados.",
        tone: "success",
      });
    } catch (error) {
      await alert({
        title: "No se pudo guardar la firma",
        description: errorMessage(error, "Error guardando la firma de email."),
        tone: "danger",
      });
    } finally {
      setSavingSignature(false);
    }
  };

  const handleResetSignature = async () => {
    const ok = await confirm({
      title: "Restaurar firma predeterminada",
      description: "Se recuperará la firma corporativa original de Cruzial.",
      confirmLabel: "Restaurar",
      tone: "warning",
    });
    if (!ok) return;

    setResettingSignature(true);
    try {
      const restored = await configuracionService.firmaEmailRestaurar();
      setSignatureStatus(restored);
      setEmailSignature(restored.signature_html);
      setSignatureFields(signatureFieldsFromHtml(restored.signature_html));
    } catch (error) {
      await alert({
        title: "No se pudo restaurar la firma",
        description: errorMessage(error, "Error restaurando la firma."),
        tone: "danger",
      });
    } finally {
      setResettingSignature(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Eliminar configuración SMTP",
      description: "Las campañas no podrán enviarse hasta configurar otra cuenta.",
      confirmLabel: "Eliminar",
      tone: "warning",
    });
    if (!ok) return;
    setRemoving(true);
    try {
      await configuracionService.smtpEliminar();
      await load();
      window.dispatchEvent(new Event("cruzial:smtp-updated"));
    } catch (error) {
      await alert({ title: "No se pudo eliminar", description: errorMessage(error, "Error eliminando SMTP."), tone: "danger" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <PageShell constrained>
      <PageHeader
        title="Configuración"
        description="Ajustes locales de la base de datos y del correo saliente. No hay usuarios, cuentas ni organización que administrar."
        actions={
          <Button leftIcon={<RefreshCw size={16} />} onClick={() => void load()} isLoading={loading}>
            Actualizar estado
          </Button>
        }
      />

      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Database size={22} className="mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--app-text)]">Base de datos SQLite</h2>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                  La ruta se cambia en <code>.env</code> mediante <code>CRUZIAL_DB_PATH</code>. En Windows admite ruta local, unidad de red o UNC; en macOS usa una ruta local o un volumen montado en <code>/Volumes</code>.
                </p>
              </div>
            </div>
            <Badge variant={localStatus?.database_ok ? "green" : "amber"}>
              {localStatus?.database_ok ? "Conectada" : "Revisar conexión"}
            </Badge>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Field label="Ruta activa">
              <Input value={localStatus?.database_path || "Cargando..."} readOnly />
            </Field>
            <Field label="Carpeta de logs">
              <Input value={localStatus?.log_path || "Cargando..."} readOnly leftIcon={<FileText size={16} />} />
            </Field>
          </div>
          <p className="mt-3 text-sm text-[var(--app-text-muted)]">{localStatus?.database_message || "Comprobando acceso..."}</p>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileText size={22} className="mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--app-text)]">Contexto para IA</h2>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                  Instrucciones base que se copian desde Campañas email. Cruzial no envía nada a una IA: solo prepara el texto y lo deja en el portapapeles.
                </p>
              </div>
            </div>
            <Badge variant={aiPromptStatus?.is_default ? "slate" : "blue"}>
              {aiPromptStatus?.is_default ? "Predeterminado" : "Personalizado"}
            </Badge>
          </div>

          <div className="mt-5">
            <Field
              label="Prompt base"
              description="Cruzial añadirá automáticamente los tags disponibles, el asunto, el cuerpo, los destinatarios y los adjuntos actuales."
            >
              <Textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                rows={9}
                maxLength={20000}
                className="min-h-[210px] font-mono text-sm leading-6"
                placeholder="Instrucciones para la IA..."
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] pt-4">
            <p className="text-xs text-[var(--app-text-muted)]">
              Los tags de campaña siempre se escribirán como <code>{"{{tag}}"}</code>.
            </p>
            <div className="flex gap-2">
              <Button
                leftIcon={<RotateCcw size={16} />}
                onClick={handleResetAiPrompt}
                isLoading={resettingAiPrompt}
                disabled={loading}
              >
                Restaurar
              </Button>
              <Button
                variant="primary"
                leftIcon={<Save size={16} />}
                onClick={handleSaveAiPrompt}
                isLoading={savingAiPrompt}
                disabled={loading}
              >
                Guardar prompt
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Mail size={22} className="mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--app-text)]">Email y SMTP</h2>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                  La contraseña se cifra antes de guardarse. Puedes editar el email, remitente o servidor sin volver a escribirla; escribe una nueva solo si quieres cambiarla.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={smtpStatus?.configured ? "green" : "amber"}>
                {smtpStatus?.configured ? "SMTP validado" : "SMTP pendiente"}
              </Badge>
              {smtpStatus?.configured && (
                <Button variant="danger" size="sm" leftIcon={<Trash2 size={15} />} onClick={handleDelete} isLoading={removing}>
                  Eliminar
                </Button>
              )}
            </div>
          </div>

          {smtpStatus?.last_test_error && !smtpStatus.configured && (
            <div className="mt-4 rounded-sm border border-[var(--intent-warning-border)] bg-[var(--intent-warning-bg)] p-3 text-sm text-[var(--app-text)]">
              {smtpStatus.last_test_error}
            </div>
          )}

          <form className="mt-5 space-y-5" onSubmit={handleSave}>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Usuario / email SMTP" required>
                <Input type="email" value={smtpUsername} onChange={(event) => setSmtpUsername(event.target.value)} placeholder="correo@empresa.com" autoComplete="username" />
              </Field>
              <Field
                label={
                  <span className="inline-flex items-center gap-1.5">
                    Contraseña SMTP
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                      title="Google: generar contraseña de aplicación"
                      aria-label="Abrir Google para generar una contraseña de aplicación"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <HelpCircle size={14} strokeWidth={1.8} />
                    </a>
                  </span>
                }
                required={!smtpStatus?.configured}
                description={smtpStatus?.configured ? "Déjala vacía para conservar la contraseña cifrada actual." : "Introduce la contraseña o contraseña de aplicación."}
              >
                <Input
                  type={showSmtpPassword ? "text" : "password"}
                  value={smtpPassword}
                  onChange={(event) => setSmtpPassword(event.target.value)}
                  placeholder={smtpStatus?.configured ? "Sin cambios" : "Contraseña o contraseña de aplicación"}
                  autoComplete="new-password"
                  rightIcon={
                    <button
                      type="button"
                      className="pointer-events-auto rounded p-1 hover:bg-[var(--app-surface-muted)]"
                      onClick={() => setShowSmtpPassword((visible) => !visible)}
                      aria-label={showSmtpPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      title={showSmtpPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showSmtpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
              </Field>
              <Field label="Nombre remitente">
                <Input value={fromName} onChange={(event) => setFromName(event.target.value)} placeholder="Cruzial" />
              </Field>
              <Field label="Email remitente">
                <Input type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} placeholder="Si se deja vacío usa el usuario SMTP" />
              </Field>
              <Field label="Reply-To">
                <Input type="email" value={replyTo} onChange={(event) => setReplyTo(event.target.value)} placeholder="Opcional" />
              </Field>
              <Field label="Seguridad">
                <Select value={smtpSecurity} onChange={(event) => setSmtpSecurity(event.target.value)}>
                  <option value="ssl">SSL (habitualmente 465)</option>
                  <option value="starttls">STARTTLS (habitualmente 587)</option>
                </Select>
              </Field>
            </div>

            <Switch
              checked={autoDiscover}
              onChange={setAutoDiscover}
              label="Detectar servidor automáticamente"
              description="Prueba proveedores conocidos y mail.dominio / smtp.dominio. Desactívalo si conoces el servidor exacto."
            />

            {!autoDiscover && (
              <div className="grid gap-4 rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 md:grid-cols-2">
                <Field label="Servidor SMTP" required>
                  <Input value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} placeholder="mail.empresa.com" />
                </Field>
                <Field label="Puerto" required>
                  <Input type="number" min="1" max="65535" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} />
                </Field>
              </div>
            )}

            <div className="border-t border-[var(--app-border)] pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--app-text)]">Firma de los correos</h3>
                  <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                    Admite HTML. Usa <code>{"{{nombre_remitente}}"}</code> para insertar el nombre del remitente y <code>cid:firmaLogo</code> para el logo corporativo. Si la dejas vacía, no se añadirá firma.
                  </p>
                </div>
                <Badge variant={signatureStatus?.is_default ? "slate" : "blue"}>
                  {signatureStatus?.is_default ? "Predeterminada" : "Personalizada"}
                </Badge>
              </div>
              <div className="mb-4 rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-[var(--app-text)]">Datos de la firma</h4>
                  <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                    Modifica estos campos sin tocar HTML. Al cambiar cualquiera de ellos se regenera la firma con la plantilla de Cruzial.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nombre">
                    <Input
                      value={signatureFields.nombre}
                      onChange={(event) => updateSignatureField("nombre", event.target.value)}
                      placeholder="Ej: Ignacio González Riancho"
                    />
                  </Field>
                  <Field label="Empresa / cargo">
                    <Input
                      value={signatureFields.empresa}
                      onChange={(event) => updateSignatureField("empresa", event.target.value)}
                      placeholder="Grupo Publicitario Cruzial"
                    />
                  </Field>
                  <Field label="Teléfono">
                    <Input
                      value={signatureFields.telefono}
                      onChange={(event) => updateSignatureField("telefono", event.target.value)}
                      placeholder="942 03 34 04"
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={signatureFields.email}
                      onChange={(event) => updateSignatureField("email", event.target.value)}
                      placeholder="admin@cruzialpublicidad.com"
                    />
                  </Field>
                  <Field label="Dirección" className="md:col-span-2">
                    <Input
                      value={signatureFields.direccion}
                      onChange={(event) => updateSignatureField("direccion", event.target.value)}
                      placeholder="Dirección postal"
                    />
                  </Field>
                </div>
              </div>

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-[var(--app-text)]">Vista previa de la firma</h4>
                  <span className="text-xs text-[var(--app-text-muted)]">Así se añadirá al final del correo</span>
                </div>
                <div className="min-h-[180px] rounded-sm border border-[var(--app-border)] bg-white p-6">
                  {signaturePreviewHtml ? (
                    <div
                      className="email-preview-signature text-[14px] leading-[1.65] text-[#333]"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(signaturePreviewHtml) }}
                    />
                  ) : (
                    <div className="flex min-h-[130px] items-center justify-center text-sm text-[var(--app-text-muted)]">
                      La firma está vacía.
                    </div>
                  )}
                </div>
              </div>

              <details className="rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)]">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[var(--app-text)]">
                  HTML avanzado de la firma
                </summary>
                <div className="border-t border-[var(--app-border)] p-4">
                  <p className="mb-2 text-xs text-[var(--app-text-muted)]">
                    Puedes personalizar completamente el HTML. Si después cambias un campo de arriba, se volverá a generar la plantilla estructurada.
                  </p>
                  <Textarea
                    value={emailSignature}
                    onChange={(event) => setEmailSignature(event.target.value)}
                    rows={10}
                    maxLength={50000}
                    className="min-h-[220px] font-mono text-sm leading-6"
                    placeholder="HTML de la firma..."
                  />
                </div>
              </details>

              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={handleResetSignature}
                  isLoading={resettingSignature}
                  disabled={loading}
                >
                  Restaurar firma
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  leftIcon={<Save size={16} />}
                  onClick={handleSaveSignature}
                  isLoading={savingSignature}
                  disabled={loading}
                >
                  Guardar firma
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] pt-4">
              <div className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
                <ShieldCheck size={16} />
                <span>Configuración local · credencial cifrada</span>
              </div>
              <div className="flex gap-2">
                <Button leftIcon={<Wifi size={16} />} onClick={handleTest} isLoading={testing}>
                  Probar conexión
                </Button>
                <Button type="submit" variant="primary" leftIcon={<Save size={16} />} isLoading={saving}>
                  Probar y guardar
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}
