from asyncpg import Record


def assert_found(record: Record | None, exception: type[Exception]) -> Record:
    if not record:
        raise exception("No record found")
    return record
