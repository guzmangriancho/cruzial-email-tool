import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Database,
  FileText,
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
  type LocalStatus,
  type SmtpPayload,
  type SmtpStatus,
} from "../services/configuracionService";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function AjustesPage() {
  const { alert, confirm } = useDialog();
  const [localStatus, setLocalStatus] = useState<LocalStatus | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);
  const [aiPromptStatus, setAiPromptStatus] = useState<AiPromptStatus | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [savingAiPrompt, setSavingAiPrompt] = useState(false);
  const [resettingAiPrompt, setResettingAiPrompt] = useState(false);
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
      const [local, smtp, promptIa] = await Promise.all([
        configuracionService.estado(),
        configuracionService.smtpEstado(),
        configuracionService.promptIa(),
      ]);
      setLocalStatus(local);
      setSmtpStatus(smtp);
      setAiPromptStatus(promptIa);
      setAiPrompt(promptIa.prompt);
      setSmtpUsername(smtp.smtp_username || "");
      setFromName(smtp.from_name || "Cruzial");
      setFromEmail(smtp.from_email || "");
      setReplyTo(smtp.reply_to || "");
      setSmtpHost(smtp.smtp_host || "");
      setSmtpPort(String(smtp.smtp_port || 465));
      setSmtpSecurity(smtp.smtp_security || "ssl");
      setAutoDiscover(!smtp.smtp_host);
      setSmtpPassword("");
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

  const validate = async () => {
    if (!smtpUsername.trim() || !smtpPassword) {
      await alert({
        title: "Faltan credenciales",
        description: "Introduce usuario/email y contraseña SMTP. La contraseña nunca se muestra una vez guardada.",
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
                  La ruta se cambia en <code>.env</code> mediante <code>CRUZIAL_DB_PATH</code>. Puede ser una ruta local, unidad de red o UNC.
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
                  La contraseña se cifra antes de guardarse en la base de datos. Para modificar la cuenta debes volver a escribirla.
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
                <Input value={smtpUsername} onChange={(event) => setSmtpUsername(event.target.value)} placeholder="correo@empresa.com" />
              </Field>
              <Field label="Contraseña SMTP" required description={smtpStatus?.smtp_username ? "Por seguridad la contraseña guardada no se recupera en pantalla." : undefined}>
                <Input type="password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} placeholder="Contraseña o contraseña de aplicación" autoComplete="new-password" />
              </Field>
              <Field label="Nombre remitente">
                <Input value={fromName} onChange={(event) => setFromName(event.target.value)} placeholder="Cruzial" />
              </Field>
              <Field label="Email remitente">
                <Input value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} placeholder="Si se deja vacío usa el usuario SMTP" />
              </Field>
              <Field label="Reply-To">
                <Input value={replyTo} onChange={(event) => setReplyTo(event.target.value)} placeholder="Opcional" />
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
