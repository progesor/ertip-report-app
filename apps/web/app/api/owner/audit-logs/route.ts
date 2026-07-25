import { can } from '@ertip/auth';
import type { QueryResultRow } from 'pg';

import { getReportingPool } from '@/lib/reporting';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AuditRow extends QueryResultRow {
  readonly id: string;
  readonly actor_display_name: string | null;
  readonly actor_email: string | null;
  readonly action: string;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly business_unit_scope: string | null;
  readonly safe_metadata_json: Readonly<Record<string, unknown>>;
  readonly created_at: Date;
}

export async function GET(): Promise<Response> {
  const user = await getCurrentSession();

  if (!user) {
    return Response.json({ ok: false, error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  }

  if (!can(user.role, 'admin:audit')) {
    return Response.json({ ok: false, error: 'AUDIT_ACCESS_DENIED' }, { status: 403 });
  }

  const result = await getReportingPool().query<AuditRow>(
    `SELECT
       audit.id::text,
       users.display_name AS actor_display_name,
       users.email AS actor_email,
       audit.action,
       audit.entity_type,
       audit.entity_id,
       audit.business_unit_scope,
       audit.safe_metadata_json,
       audit.created_at
     FROM audit_logs AS audit
     LEFT JOIN users ON users.id = audit.actor_user_id
     ORDER BY audit.created_at DESC, audit.id DESC
     LIMIT 100`,
  );

  return Response.json(
    {
      ok: true,
      events: result.rows.map((row) => ({
        id: row.id,
        actorDisplayName: row.actor_display_name,
        actorEmail: row.actor_email,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        businessUnitScope: row.business_unit_scope,
        metadata: row.safe_metadata_json,
        createdAt: row.created_at.toISOString(),
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
