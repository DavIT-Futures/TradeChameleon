package com.tradechameleon.market;

import com.tradechameleon.shared.AssetClass;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class InstrumentRepository {

    private final JdbcClient jdbc;

    InstrumentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    List<Instrument> findAll() {
        return jdbc.sql("select * from instrument order by asset_class, category, symbol")
                .query((rs, n) -> new Instrument(
                        rs.getString("symbol"),
                        rs.getString("name"),
                        AssetClass.valueOf(rs.getString("asset_class")),
                        rs.getString("exchange"),
                        rs.getString("currency"),
                        rs.getInt("decimals"),
                        rs.getBigDecimal("base_price"),
                        rs.getString("category"),
                        rs.getString("unit"),
                        rs.getBigDecimal("contract_size").stripTrailingZeros(),
                        rs.getBigDecimal("pip_size") == null ? null : rs.getBigDecimal("pip_size").stripTrailingZeros(),
                        rs.getBoolean("optionable"),
                        rs.getString("description")))
                .list();
    }
}
