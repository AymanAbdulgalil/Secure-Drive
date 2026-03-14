from __future__ import annotations

from asyncpg import Connection


async def delete_stale_refresh_tokens(
    *,
    conn: Connection,
    batch_size: int = 1000,
) -> int:
    """Delete all revoked or expired token rows in fixed-size batches.

    Batching prevents a single massive ``DELETE`` from locking the table for
    too long in busy production environments.  The loop continues until fewer
    than ``batch_size`` rows are deleted, indicating the backlog is clear.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    batch_size:
        Maximum number of rows to delete per iteration.  Defaults to 1 000.

    Returns
    -------
    int
        Total number of rows deleted across all batches.
    """
    total = 0
    while True:
        result = await conn.execute(
            """
            DELETE FROM refresh_tokens
             WHERE token_id IN (
                   SELECT token_id
                     FROM refresh_tokens
                    WHERE revoked = TRUE
                       OR expires_at <= NOW() AT TIME ZONE 'utc'
                    LIMIT $1
             )
            """,
            batch_size,
        )
        deleted = int(result.split()[-1])
        total += deleted
        if deleted < batch_size:
            break
    return total

