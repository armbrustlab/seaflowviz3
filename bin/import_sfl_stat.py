import argparse
import dateutil.parser
import sys
from sqlalchemy import Column, Integer, Float, Date, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine
from sqlalchemy.sql import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy import UniqueConstraint

Base = declarative_base()

class SFL(Base):
    __tablename__ = "sfl"
    id = Column(Integer, primary_key=True, nullable=False)
    cruise = Column(String(100), index=True)
    file = Column(String(100))
    date = Column(String(100), index=True)
    file_duration = Column(Float)
    lat = Column(Float)
    lon = Column(Float)
    conductivity = Column(Float)
    salinity = Column(Float)
    ocean_tmp = Column(Float)
    par = Column(Float)
    bulk_red = Column(Float)
    stream_pressure = Column(Float)
    flow_rate = Column(Float)
    event_rate = Column(Float)
    epoch_ms = Column(Integer, index=True)

    __table_args__ = (
        UniqueConstraint("cruise", "file"),
        {'sqlite_autoincrement': True}
    )

class Stat(Base):
    __tablename__ = "stat"
    id = Column(Integer, primary_key=True, nullable=False)
    cruise = Column(String(100), index=True)
    file = Column(String(100))
    time = Column(String(100))
    date = Column(String(100), index=True)
    lat = Column(Float)
    lon = Column(Float)
    opp_evt_ratio = Column(Float)
    flow_rate = Column(Float)
    file_duration = Column(Float)
    pop = Column(String(100))
    n_count = Column(Integer)
    abundance = Column(Float)
    fsc_small = Column(Float)
    chl_small = Column(Float)
    pe = Column(Float)
    epoch_ms = Column(Integer, index=True)

    __table_args__ = (
        UniqueConstraint("cruise", "file", "pop"),
        {'sqlite_autoincrement': True}
    )


def read_csv(csv_file):
    rows = []
    with open(csv_file) as fh:
        header = {}
        i = 0
        for line in fh:
            fields = line.rstrip().split(",")
            if i == 0:
                header = {f: i for i, f in enumerate(fields)}
            else:
                rows.append({k: fields[header[k]] for k in header})
            i += 1
    return rows


def table_coercer(table_class):
    sqlalchemy_type_to_python = {
        "Float": float,
        "Integer": int,
        "String": str
    }
    c = {}
    for col in table_class.__table__.columns:
        sqltype = repr(col.type)
        sqltype = sqltype[:sqltype.index("(")]
        colname = str(col)
        colname = colname[colname.index(".")+1:]
        c[colname] = sqlalchemy_type_to_python[sqltype]
    return c


def coerce_row(row, coercer):
    for k in row:
        try:
            val = coercer[k](row[k])
        except ValueError:
            val = None
        row[k] = val


def date2epoch_ms(datestr):
    date = dateutil.parser.parse(datestr)
    epoch_start = dateutil.parser.parse("1970-01-01T00:00:00+00:00")
    epoch_ms = 1000 * (date - epoch_start).total_seconds()
    return epoch_ms


def read_sfl(csv):
    coercer = table_coercer(SFL)
    rows = read_csv(csv)
    for r in rows:
        coerce_row(r, coercer)
        r["epoch_ms"] = date2epoch_ms(r["date"])
    return rows


def read_stat(csv):
    coercer = table_coercer(Stat)
    rows = read_csv(csv)
    for r in rows:
        coerce_row(r, coercer)
        if "time" in r:
            r["date"] = r["time"]
        r["epoch_ms"] = date2epoch_ms(r["date"])
    return rows


def getLastRealtimeSfl(session):
    query = session.query(SFL).filter_by(cruise="realtime")
    result = query.order_by(SFL.epoch_ms.desc()).first()
    if result:
        return result.epoch_ms
    return None


def getLastRealtimeStat(session):
    query = session.query(Stat).filter_by(cruise="realtime")
    result = query.order_by(Stat.epoch_ms.desc()).first()
    if result:
        return result.epoch_ms
    return None


def getPops(session, epoch_ms):
    rows = session.query(Stat.pop).filter_by(epoch_ms=epoch_ms)
    return [r.pop for r in rows]


def sflFilter(rows, session):
    last = getLastRealtimeSfl(session)
    if not last:
        return rows

    filt = []
    for r in rows:
        if r["cruise"] != "realtime":
            filt.append(r)
        elif r["epoch_ms"] > last:
            filt.append(r)
    return filt


def statFilter(rows, session):
    last = getLastRealtimeStat(session)
    if not last:
        return rows

    last_pops = getPops(session, last)
    filt = []
    for r in rows:
        if r["cruise"] != "realtime":
            filt.append(r)
        elif r["epoch_ms"] > last:
            filt.append(r)
        elif r["epoch_ms"] == last:
            if r["pop"] not in last_pops:
                 filt.append(r)
    return filt


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Insert SFL and Stat SeaFlow data into sqlite3 viz db."
    )
    parser.add_argument("sfl", help="SFL CSV file")
    parser.add_argument("stat", help="Stat CSV file")
    parser.add_argument("db", help="SQLite3 DB file")
    args = parser.parse_args()

    engine = create_engine("sqlite:///{}".format(args.db))
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    s = Session()

    try:
        # Only import new realtime data
        # Import any other cruise data
        rows = sflFilter(read_sfl(args.sfl), s)
        s.bulk_insert_mappings(SFL, rows)
        s.commit()
        print "Inserted {} SFL rows".format(len(rows))

        # Only import new realtime data
        # Import any other cruise data
        rows = statFilter(read_stat(args.stat), s)
        s.bulk_insert_mappings(Stat, rows)
        s.commit()
        print "Inserted {} Stat rows".format(len(rows))
    finally:
        s.close()
