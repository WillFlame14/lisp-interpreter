(let [empty? (fn [list] (= (count list) 0))
      map (fn [list f]
            (if (empty? list)
              list
              (let [head (peek list)
                    rest (pop list)]
                (cons (f head) (map rest f)))))]
  (map (quote (1 2 3 4 5)) (fn [x] (+ x 2))))