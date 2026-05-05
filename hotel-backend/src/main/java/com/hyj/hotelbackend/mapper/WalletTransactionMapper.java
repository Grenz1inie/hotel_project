package com.hyj.hotelbackend.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hyj.hotelbackend.entity.WalletTransaction;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WalletTransactionMapper extends BaseMapper<WalletTransaction> {
}
