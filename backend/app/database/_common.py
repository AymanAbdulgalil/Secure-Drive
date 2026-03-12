from asyncpg import Record

def assert_found(record: Record | None, exception: type[Exception]) -> Record:
    if not record:
        raise exception(f"No record found")
    if not isinstance(record, Record):
        raise TypeError(f"Expected asyncpg.Record, got: {type(record)}")
    return record
