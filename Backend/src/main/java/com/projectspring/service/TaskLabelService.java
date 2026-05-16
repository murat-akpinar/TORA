package com.projectspring.service;

import com.projectspring.dto.TaskLabelDTO;
import com.projectspring.model.TaskLabel;
import com.projectspring.model.Team;
import com.projectspring.repository.TaskLabelRepository;
import com.projectspring.repository.TeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class TaskLabelService {

    private static final String[] COLOR_PALETTE = {
        "#89b4fa", "#a6e3a1", "#f38ba8", "#fab387",
        "#cba6f7", "#89dceb", "#f9e2af", "#74c7ec", "#b4befe"
    };

    @Autowired
    private TaskLabelRepository labelRepository;

    @Autowired
    private TeamRepository teamRepository;

    public List<TaskLabelDTO> searchLabels(Long teamId, String search) {
        List<TaskLabel> labels = (search == null || search.isBlank())
            ? labelRepository.findByTeamIdOrderByNameAsc(teamId)
            : labelRepository.searchByTeamIdAndName(teamId, search.trim());
        return labels.stream().map(this::toDTO).collect(Collectors.toList());
    }

    public TaskLabel findOrCreate(Long teamId, String name) {
        String trimmed = name.trim();
        return labelRepository.findByNameIgnoreCaseAndTeamId(trimmed, teamId)
            .orElseGet(() -> {
                Team team = teamRepository.findById(teamId)
                    .orElseThrow(() -> new RuntimeException("Team not found: " + teamId));
                long count = labelRepository.countByTeamId(teamId);
                String color = COLOR_PALETTE[(int) (count % COLOR_PALETTE.length)];
                TaskLabel label = new TaskLabel();
                label.setName(trimmed);
                label.setColor(color);
                label.setTeam(team);
                return labelRepository.save(label);
            });
    }

    public TaskLabelDTO toDTO(TaskLabel label) {
        return new TaskLabelDTO(label.getId(), label.getName(), label.getColor(), label.getTeam().getId());
    }
}
