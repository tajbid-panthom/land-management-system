import {
  SYSTEM_SETTINGS,
  STORAGE_RULES,
  WORKFLOW_RULES,
  type IntegrationStatus,
} from "@/lib/settings/config";
import { ROLES } from "@/lib/auth/rbac";

const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  super_admin: "Super Admin",
  land_officer: "Land Officer",
  field_verifier: "Field Verifier",
  approver: "Approver",
  bank_viewer: "Bank Viewer",
  legal_officer: "Legal Officer",
  property_owner: "Property Owner",
  public_user: "Public User",
};

function StatusPill({ configured }: { configured: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        configured
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-800"
      }`}
    >
      {configured ? "Configured" : "Not configured"}
    </span>
  );
}

function SettingCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-sky-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsPanel({
  integrations,
}: {
  integrations: IntegrationStatus;
}) {
  return (
    <div className="space-y-6">
      <SettingCard title="Upload & validation">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">
              Maximum upload size
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {SYSTEM_SETTINGS.maxUploadMb} MB
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">
              Ownership share total
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {SYSTEM_SETTINGS.ownershipShareTotal}%
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase text-slate-500">
              Supported file formats
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {SYSTEM_SETTINGS.allowedMimeTypes.join(", ")}
            </dd>
          </div>
        </dl>
      </SettingCard>

      <SettingCard title="Integrations">
        <div className="overflow-hidden rounded-lg border border-sky-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-sky-100">
                <td className="px-4 py-3 font-medium">PostgreSQL</td>
                <td className="px-4 py-3 text-slate-600">Primary database</td>
                <td className="px-4 py-3">
                  <StatusPill configured={integrations.database} />
                </td>
              </tr>
              <tr className="border-t border-sky-100">
                <td className="px-4 py-3 font-medium">NextAuth</td>
                <td className="px-4 py-3 text-slate-600">
                  Session authentication ({SYSTEM_SETTINGS.sessionStrategy})
                </td>
                <td className="px-4 py-3">
                  <StatusPill configured={integrations.nextAuth} />
                </td>
              </tr>
              <tr className="border-t border-sky-100">
                <td className="px-4 py-3 font-medium">Encryption</td>
                <td className="px-4 py-3 text-slate-600">
                  NID and sensitive field encryption
                </td>
                <td className="px-4 py-3">
                  <StatusPill configured={integrations.encryption} />
                </td>
              </tr>
              <tr className="border-t border-sky-100">
                <td className="px-4 py-3 font-medium">
                  {SYSTEM_SETTINGS.publicStorageProvider}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  Maps and property photos
                </td>
                <td className="px-4 py-3">
                  <StatusPill configured={integrations.cloudinary} />
                </td>
              </tr>
              <tr className="border-t border-sky-100">
                <td className="px-4 py-3 font-medium">
                  {SYSTEM_SETTINGS.confidentialStorageProvider}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  Deeds, khatian copies, confidential documents
                </td>
                <td className="px-4 py-3">
                  <StatusPill configured={integrations.r2} />
                </td>
              </tr>
              <tr className="border-t border-sky-100">
                <td className="px-4 py-3 font-medium">
                  {SYSTEM_SETTINGS.emailProvider}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  Mutation decision notifications
                </td>
                <td className="px-4 py-3">
                  <StatusPill configured={integrations.resend} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SettingCard>

      <SettingCard title="Document storage rules">
        <div className="space-y-3">
          {STORAGE_RULES.map((rule) => (
            <div
              key={rule.provider}
              className="rounded-lg border border-sky-100 bg-sky-50/40 p-4 text-sm"
            >
              <p className="font-medium text-slate-900">{rule.provider}</p>
              <p className="mt-1 text-slate-600">{rule.types}</p>
              <p className="mt-1 text-xs text-slate-500">
                Sensitivity: {rule.sensitivity}
              </p>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Workflow rules">
        <div className="space-y-4">
          {WORKFLOW_RULES.map((rule) => (
            <div key={rule.title}>
              <h3 className="text-sm font-medium text-slate-900">
                {rule.title}
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {rule.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Roles">
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((role) => (
            <div
              key={role}
              className="rounded-lg border border-sky-100 px-4 py-3 text-sm"
            >
              <p className="font-medium text-slate-900">{ROLE_LABELS[role]}</p>
              <p className="mt-1 font-mono text-xs text-slate-500">{role}</p>
            </div>
          ))}
        </div>
      </SettingCard>
    </div>
  );
}
