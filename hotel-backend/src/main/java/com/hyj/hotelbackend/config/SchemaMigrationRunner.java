package com.hyj.hotelbackend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class SchemaMigrationRunner implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(SchemaMigrationRunner.class);

    private final JdbcTemplate jdbcTemplate;

    public SchemaMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void afterPropertiesSet() {
        try {
            // 1. 检查 bookings 表上 payment_status 列的 CHECK 约束
            String constraintName = findCheckConstraintName("BOOKINGS", "PAYMENT_STATUS");
            if (constraintName == null) {
                // 无约束：直接添加新约束
                addCheckConstraint();
                log.info("Added CHECK constraint for payment_status including WAIVED");
                return;
            }

            // 2. 获取现有约束的条件
            String condition = getConstraintCondition(constraintName);
            if (condition == null) {
                // 异常情况，重新创建约束
                dropConstraint(constraintName);
                addCheckConstraint();
                log.info("Recreated CHECK constraint for payment_status including WAIVED");
                return;
            }

            // 3. 检查条件中是否已包含 'WAIVED'
            if (!condition.contains("'WAIVED'") && !condition.contains("\"WAIVED\"")) {
                // 缺少 WAIVED，先删除旧约束，再添加新约束
                dropConstraint(constraintName);
                addCheckConstraint();
                log.info("Updated CHECK constraint for payment_status to include WAIVED");
            } else {
                log.info("CHECK constraint for payment_status already contains WAIVED, nothing to do");
            }

        } catch (Exception ex) {
            log.warn("Failed to ensure payment_status constraint includes WAIVED", ex);
        }
    }

    /**
     * 查找表上指定列的 CHECK 约束名称
     */
    private String findCheckConstraintName(String tableName, String columnName) {
        String sql = "SELECT c.constraint_name " +
                "FROM user_constraints c " +
                "JOIN user_cons_columns cc ON c.constraint_name = cc.constraint_name " +
                "WHERE c.table_name = ? " +
                "  AND c.constraint_type = 'C' " +
                "  AND cc.column_name = ? " +
                "  AND ROWNUM = 1";
        List<String> results = jdbcTemplate.queryForList(sql, String.class, tableName, columnName);
        return results.isEmpty() ? null : results.get(0);
    }

    /**
     * 获取指定约束的搜索条件
     */
    private String getConstraintCondition(String constraintName) {
        String sql = "SELECT search_condition FROM user_constraints WHERE constraint_name = ?";
        List<String> results = jdbcTemplate.queryForList(sql, String.class, constraintName);
        return results.isEmpty() ? null : results.get(0);
    }

    /**
     * 删除约束
     */
    private void dropConstraint(String constraintName) {
        jdbcTemplate.execute("ALTER TABLE bookings DROP CONSTRAINT " + constraintName);
        log.debug("Dropped constraint {}", constraintName);
    }

    /**
     * 添加允许所有状态的 CHECK 约束
     */
    private void addCheckConstraint() {
        String sql = "ALTER TABLE bookings ADD CONSTRAINT ck_bookings_payment_status " +
                "CHECK (payment_status IN ('UNPAID','PAID','PARTIAL_REFUND','REFUNDED','WAIVED'))";
        jdbcTemplate.execute(sql);
        log.debug("Added CHECK constraint ck_bookings_payment_status");
    }
}
